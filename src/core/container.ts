/* ════════════════════════════════════════════════════════════════
 *  React River — RiverContainer
 *  The core state container — stores, tracks, and manages all
 *  provider states. Framework-agnostic (no React dependency).
 * ════════════════════════════════════════════════════════════════ */

import { asyncData, asyncError, asyncLoading, asyncValueEquals } from './async_value';

import type { AsyncValue } from './async_value';
import type { Notifier, AsyncNotifier } from './notifier';
import type { RiverObserver } from './observer';
import type {
  PromiseProvider,
  ListenerCallback,
  NotifierAccessor,
  PromiseAccessor,
  ProviderBase,
  ProviderOverride,
  Ref,
  StateController,
  StateProvider,
  ObservableProvider,
  ObservableLike,
  Unsubscribe,
} from './types';

// ── Internal Provider State ────────────────────────────────────

interface ProviderState {
  value: unknown;
  previousValue: unknown | undefined;
  version: number;

  /** useSyncExternalStore subscriptions — just () => void */
  snapshotListeners: Set<() => void>;
  /** Explicit value listeners — receives (prev, next) */
  valueListeners: Set<ListenerCallback<unknown>>;

  /** Providers this one depends on (via ref.watch) */
  dependencies: Set<ProviderBase>;
  /** Providers that depend on this one */
  dependents: Set<symbol>;
  /** Selectors used by dependents. A value of null means unconditional dependency. */
  watchSelectors?: Map<symbol, Array<{ selector: (val: unknown) => unknown; lastValue: unknown }> | null>;

  /** Cleanup callbacks registered via ref.onDispose */
  disposeCallbacks: (() => void)[];
  /** Callbacks for when last listener removed */
  cancelCallbacks: (() => void)[];
  /** Callbacks for when listener added after cancel */
  resumeCallbacks: (() => void)[];

  /** Timeout for cacheTime before auto-dispose */
  disposeTimeout?: ReturnType<typeof setTimeout>;

  /** The notifier/controller instance (for notifier-based providers) */
  notifierInstance?: unknown;
  /** AbortController for async operations */
  abortController?: AbortController;

  initialized: boolean;
}

// ── DevTools Snapshot (read-only inspection) ───────────────────

export interface DevToolsProviderSnapshot {
  id: symbol;
  name: string;
  kind: string;
  value: unknown;
  previousValue: unknown | undefined;
  version: number;
  initialized: boolean;
  listenerCount: number;
  dependencyCount: number;
  dependentCount: number;
  dependencies: string[];
  dependents: string[];
  autoDispose: boolean;
  cacheTime: number | undefined;
}

// ── Container Options ──────────────────────────────────────────

export interface RiverContainerOptions {
  parent?: RiverContainer;
  overrides?: ProviderOverride[];
  observers?: RiverObserver[];
}

// ── RiverContainer ─────────────────────────────────────────────

export class RiverContainer {
  private states = new Map<symbol, ProviderState>();
  private overrideMap = new Map<symbol, ProviderOverride>();
  private providerMap = new Map<symbol, ProviderBase>();
  private initializingStack = new Set<symbol>();
  private parent: RiverContainer | undefined;
  private observers: RiverObserver[];
  private disposed = false;

  constructor(options: RiverContainerOptions = {}) {
    this.parent = options.parent;
    this.observers = options.observers ?? [];

    if (options.overrides) {
      for (const override of options.overrides) {
        this.overrideMap.set(override.original.id, override);
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────

  /** Read a provider's current value (initializes lazily). */
  read<T>(provider: ProviderBase<T>): T {
    this.assertNotDisposed();
    this.providerMap.set(provider.id, provider);
    return this.ensureInitialized(provider) as T;
  }

  /**
   * Subscribe to snapshot changes (for useSyncExternalStore).
   * Callback receives no arguments — just a notification.
   */
  subscribe(provider: ProviderBase, callback: () => void): Unsubscribe {
    this.assertNotDisposed();
    this.providerMap.set(provider.id, provider);
    this.ensureInitialized(provider);

    const state = this.getState(provider.id)!;
    const hadListeners = this.hasListeners(state);

    state.snapshotListeners.add(callback);

    // If transitioning from 0 → 1 listeners, fire resume
    if (!hadListeners) {
      if (state.disposeTimeout) {
        clearTimeout(state.disposeTimeout);
        state.disposeTimeout = undefined;
      }
      for (const cb of state.resumeCallbacks) cb();
    }

    return () => {
      state.snapshotListeners.delete(callback);
      this.checkAutoDispose(provider);
    };
  }

  /**
   * Listen to value changes with next/prev callback.
   * Does NOT trigger component re-renders.
   */
  listen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe {
    this.assertNotDisposed();
    this.providerMap.set(provider.id, provider);
    this.ensureInitialized(provider);

    const state = this.getState(provider.id)!;
    const hadListeners = this.hasListeners(state);

    state.valueListeners.add(callback as ListenerCallback<unknown>);

    if (!hadListeners) {
      if (state.disposeTimeout) {
        clearTimeout(state.disposeTimeout);
        state.disposeTimeout = undefined;
      }
      for (const cb of state.resumeCallbacks) cb();
    }

    return () => {
      state.valueListeners.delete(callback as ListenerCallback<unknown>);
      this.checkAutoDispose(provider);
    };
  }

  /** Force a provider to re-initialize. */
  invalidate(provider: ProviderBase): void {
    this.assertNotDisposed();
    const state = this.getState(provider.id);
    if (!state?.initialized) return;

    this.reinitialize(provider);
  }

  /** Invalidate and return the new value. */
  refresh<T>(provider: ProviderBase<T>): T {
    this.invalidate(provider);
    return this.read(provider);
  }

  /** Set a StateProvider's value directly. */
  set<T>(provider: StateProvider<T>, value: T | ((prev: T) => T)): void {
    this.assertNotDisposed();
    this.ensureInitialized(provider);

    const state = this.getState(provider.id)!;
    const current = state.value as T;
    const newValue = typeof value === 'function' ? (value as (prev: T) => T)(current) : value;

    this.updateValue(provider.id, newValue);
  }

  /** Dispose the container and all provider states. */
  dispose(): void {
    for (const [id, state] of this.states) {
      this.disposeState(id, state);
    }
    this.states.clear();
    this.overrideMap.clear();
    this.providerMap.clear();
    this.disposed = true;
  }

  /**
   * DevTools inspection — returns a read-only snapshot of all provider states.
   * This is a passive read: it does NOT subscribe, listen, or affect auto-dispose.
   */
  getProviderStates(): DevToolsProviderSnapshot[] {
    const snapshots: DevToolsProviderSnapshot[] = [];

    for (const [id, state] of this.states) {
      if (!state.initialized) continue;

      const provider = this.providerMap.get(id);
      if (!provider) continue;

      const getLabel = (sym: symbol) => {
        const p = this.providerMap.get(sym);
        return p?.name ?? sym.description ?? 'unknown';
      };

      snapshots.push({
        id,
        name: provider.name ?? provider.id.description ?? 'unknown',
        kind: provider.kind,
        value: state.value,
        previousValue: state.previousValue,
        version: state.version,
        initialized: state.initialized,
        listenerCount: state.snapshotListeners.size + state.valueListeners.size,
        dependencyCount: state.dependencies.size,
        dependentCount: state.dependents.size,
        dependencies: Array.from(state.dependencies).map((d) => d.name ?? d.id.description ?? 'unknown'),
        dependents: Array.from(state.dependents).map(getLabel),
        autoDispose: provider.options.autoDispose ?? true,
        cacheTime: provider.options.cacheTime,
      });
    }

    return snapshots;
  }

  // ── Initialization ───────────────────────────────────────────

  private ensureInitialized(provider: ProviderBase): unknown {
    // If the provider is marked as global, delegate to the root container
    if (provider.options.global && this.parent) {
      return this.getRootContainer().ensureInitialized(provider);
    }

    // Check for override
    const override = this.overrideMap.get(provider.id);

    // Check if already initialized in this container
    const localState = this.states.get(provider.id);
    if (localState?.initialized) return localState.value;

    // Non-global (default): always create a new instance in the current container
    return this.initializeProvider(provider, override);
  }

  /** Walk up the parent chain to find the root (topmost) container. */
  private getRootContainer(): RiverContainer {
    let current = this.parent;
    if (!current) return this;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  private initializeProvider(provider: ProviderBase, override?: ProviderOverride): unknown {
    // Circular dependency detection
    if (this.initializingStack.has(provider.id)) {
      throw new Error(
        `Circular dependency detected when initializing provider: ${provider.name ?? provider.id.description}`,
      );
    }
    this.initializingStack.add(provider.id);

    const state = this.createState();
    this.states.set(provider.id, state);

    const ref = this.createRef(provider.id);

    try {
      const kind = provider.kind;

      switch (kind) {
        case 'provider': {
          const p = provider as unknown as { _create: (ref: Ref) => unknown };
          const createFn = override ? override.create : p._create;
          state.value = createFn(ref);
          break;
        }

        case 'stateProvider': {
          const p = provider as StateProvider<unknown>;
          const createFn = override ? override.create : p._create;
          const initialValue = createFn(ref);
          state.value = initialValue;

          // Create StateController
          const controller: StateController<unknown> = {
            get state() {
              return state.value;
            },
            set state(v: unknown) {
              this.update(() => v);
            },
            update: (updater: (current: unknown) => unknown) => {
              const newValue = updater(state.value);
              this.updateValue(provider.id, newValue);
            },
          };
          state.notifierInstance = controller;
          break;
        }

        case 'promiseProvider': {
          const p = provider as PromiseProvider<unknown>;
          const createFn = override ? override.create : (r: Ref) => p._create(r);
          state.value = asyncLoading();

          const abortController = new AbortController();
          state.abortController = abortController;

          const promise = override ? (createFn(ref) as Promise<unknown>) : p._create(ref);

          promise.then(
            (data) => {
              if (abortController.signal.aborted) return;
              this.updateValue(provider.id, asyncData(data));
            },
            (error) => {
              if (abortController.signal.aborted) return;
              this.notifyObservers('error', provider, error);
              this.updateValue(provider.id, asyncError(error));
            },
          );
          break;
        }

        case 'observableProvider': {
          const p = provider as ObservableProvider<unknown>;
          state.value = asyncLoading();

          const abortController = new AbortController();
          state.abortController = abortController;

          const result = p._create(ref);

          const subscribe = (obs: ObservableLike<unknown>) => {
            if (abortController.signal.aborted) return;
            const subscription = obs.subscribe({
              next: (data) => {
                if (abortController.signal.aborted) return;
                this.updateValue(provider.id, asyncData(data));
              },
              error: (error) => {
                if (abortController.signal.aborted) return;
                this.notifyObservers('error', provider, error);
                this.updateValue(provider.id, asyncError(error));
              },
              complete: () => {
                // Observables completing just stops updates
              },
            });
            state.disposeCallbacks.push(() => subscription.unsubscribe());
          };

          if (result instanceof Promise) {
            result.then(
              (obs) => subscribe(obs),
              (error) => {
                if (abortController.signal.aborted) return;
                this.notifyObservers('error', provider, error);
                this.updateValue(provider.id, asyncError(error));
              },
            );
          } else {
            subscribe(result);
          }
          break;
        }

        case 'notifierProvider': {
          const p = provider as unknown as {
            _createNotifier: () => Notifier<unknown>;
          };
          const notifier = p._createNotifier();
          notifier._ref = ref;
          notifier._setState = (value: unknown) => {
            notifier._state = value;
            this.updateValue(provider.id, value);
          };

          const initialValue = notifier.build();
          notifier._state = initialValue;
          state.value = initialValue;
          state.notifierInstance = notifier;
          break;
        }

        case 'asyncNotifierProvider': {
          const p = provider as unknown as {
            _createNotifier: () => AsyncNotifier<unknown>;
          };
          const notifier = p._createNotifier();
          notifier._ref = ref;
          notifier._setState = (value: AsyncValue<unknown>) => {
            notifier._state = value;
            this.updateValue(provider.id, value);
          };

          state.value = asyncLoading();
          notifier._state = state.value as AsyncValue<unknown>;
          state.notifierInstance = notifier;

          const abortController = new AbortController();
          state.abortController = abortController;

          notifier.build().then(
            (data) => {
              if (abortController.signal.aborted) return;
              const asyncVal = asyncData(data);
              notifier._state = asyncVal;
              this.updateValue(provider.id, asyncVal);
            },
            (error) => {
              if (abortController.signal.aborted) return;
              this.notifyObservers('error', provider, error);
              const asyncVal = asyncError(error);
              notifier._state = asyncVal;
              this.updateValue(provider.id, asyncVal);
            },
          );
          break;
        }

        case 'notifierAccessor': {
          const accessor = provider as NotifierAccessor<unknown>;
          // Ensure parent is initialized
          const parentId = accessor._parentId;
          let parentProvider = this.providerMap.get(parentId);

          if (!parentProvider && accessor._parentProvider) {
            parentProvider = accessor._parentProvider;
            this.providerMap.set(parentId, parentProvider);
          }

          if (parentProvider) {
            this.ensureInitialized(parentProvider);
          }
          const parentState = this.getState(parentId);
          if (!parentState) {
            throw new Error(
              `Parent provider not found for notifier accessor: ${provider.name ?? provider.id.description}`,
            );
          }
          state.value = parentState.notifierInstance;
          break;
        }

        case 'promiseAccessor': {
          const accessor = provider as PromiseAccessor<unknown>;
          const parentProvider = accessor._parentProvider;

          // Read current parent state
          const parentValue = this.read(parentProvider) as AsyncValue<unknown>;

          // Track dependency so when parent is invalidated, the promise is also "refreshed"
          // const parentState = this.getState(parentProvider.id);
          // if (parentState) {
          //   parentState.dependents.add(provider.id);
          //   const state = this.getState(provider.id);
          //   if (state) state.dependencies.add(parentProvider);
          // }

          if (parentValue.status === 'data') {
            state.value = Promise.resolve(parentValue.data);
          } else if (parentValue.status === 'error') {
            state.value = Promise.reject(parentValue.error);
          } else {
            // Currently loading, resolve/reject when status changes
            state.value = new Promise((resolve, reject) => {
              const unsubscribe = this.listen(parentProvider, (next, _prev) => {
                const asyncNext = next as AsyncValue<unknown>;
                if (asyncNext.status === 'data') {
                  unsubscribe();
                  resolve(asyncNext.data);
                } else if (asyncNext.status === 'error') {
                  unsubscribe();
                  reject(asyncNext.error);
                }
              });
            });
          }
          break;
        }

        default:
          throw new Error(`Unknown provider kind: ${kind}`);
      }

      state.initialized = true;
      this.notifyObservers('create', provider, state.value);
    } catch (error) {
      this.initializingStack.delete(provider.id);
      this.notifyObservers('error', provider, error);
      throw error;
    }

    this.initializingStack.delete(provider.id);
    return state.value;
  }

  // ── Value updates & notification ─────────────────────────────

  private updateValue(providerId: symbol, newValue: unknown): void {
    const state = this.getState(providerId);
    if (!state) return;

    const oldValue = state.value;

    // Skip if value hasn't changed
    if (this.valuesEqual(oldValue, newValue)) return;

    state.previousValue = oldValue;
    state.value = newValue;
    state.version++;

    // Notify observers
    const provider = this.providerMap.get(providerId);
    if (provider) {
      this.notifyObservers('update', provider, newValue, oldValue);
    }

    // Notify value listeners (next, prev)
    for (const cb of Array.from(state.valueListeners)) {
      cb(newValue, oldValue);
    }

    // Notify snapshot listeners (just fire)
    for (const cb of Array.from(state.snapshotListeners)) {
      cb();
    }

    // Propagate to dependents
    this.propagateToDependents(providerId);
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    // For AsyncValue, use structural comparison
    if (a && b && typeof a === 'object' && typeof b === 'object' && 'status' in a && 'status' in b) {
      return asyncValueEquals(a as AsyncValue<unknown>, b as AsyncValue<unknown>);
    }
    return Object.is(a, b);
  }

  private propagateToDependents(providerId: symbol): void {
    const state = this.getState(providerId);
    if (!state) return;

    for (const depId of Array.from(state.dependents)) {
      const depProvider = this.providerMap.get(depId);
      if (depProvider) {
        let shouldReinitialize = true;

        if (state.watchSelectors) {
          const selectors = state.watchSelectors.get(depId);
          if (selectors) {
            // Need to evaluate if any selector's result changed
            let anyChanged = false;
            for (const item of selectors) {
              try {
                const newSelected = item.selector(state.value);
                if (!this.valuesEqual(item.lastValue, newSelected)) {
                  anyChanged = true;
                  break;
                }
              } catch {
                // If selector throws, assume value changed
                anyChanged = true;
                break;
              }
            }
            shouldReinitialize = anyChanged;
          }
        }

        if (shouldReinitialize) {
          this.reinitialize(depProvider);
        }
      }
    }
  }

  // ── Re-initialization ────────────────────────────────────────

  private reinitialize(provider: ProviderBase): void {
    const state = this.getState(provider.id);
    if (!state?.initialized) return;

    const oldValue = state.value;

    if (state.disposeTimeout) {
      clearTimeout(state.disposeTimeout);
      state.disposeTimeout = undefined;
    }

    // Run dispose callbacks
    for (const cb of Array.from(state.disposeCallbacks)) {
      try {
        cb();
      } catch {
        // Dispose callbacks should not throw
      }
    }

    // Abort any async operations
    state.abortController?.abort();

    // Clear old dependencies
    for (const depProvider of Array.from(state.dependencies)) {
      const depState = this.getState(depProvider.id);
      depState?.dependents.delete(provider.id);
      depState?.watchSelectors?.delete(provider.id);
    }
    state.dependencies.clear();
    state.disposeCallbacks = [];
    state.cancelCallbacks = [];
    state.resumeCallbacks = [];
    state.abortController = undefined;

    // Remove from states so initializeProvider creates fresh
    state.initialized = false;
    this.states.delete(provider.id);

    // Re-initialize
    const override = this.overrideMap.get(provider.id);
    this.initializeProvider(provider, override);

    // Restore listeners
    const newState = this.getState(provider.id)!;
    newState.snapshotListeners = state.snapshotListeners;
    newState.valueListeners = state.valueListeners;
    newState.dependents = state.dependents;

    // Check if value actually changed
    if (!this.valuesEqual(oldValue, newState.value)) {
      newState.previousValue = oldValue;
      newState.version++;

      this.notifyObservers('update', provider, newState.value, oldValue);

      for (const cb of Array.from(newState.valueListeners)) {
        cb(newState.value, oldValue);
      }
      for (const cb of Array.from(newState.snapshotListeners)) {
        cb();
      }

      this.propagateToDependents(provider.id);
    }
  }

  // ── Ref factory ──────────────────────────────────────────────

  private createRef(ownerId: symbol): Ref {
    return {
      watch: <T, R = T>(provider: ProviderBase<T>, select?: (value: T) => R): R => {
        this.providerMap.set(provider.id, provider);
        const rawValue = this.ensureInitialized(provider) as T;
        const selectedValue = select ? select(rawValue) : (rawValue as unknown as R);

        // Track dependency
        const ownerState = this.getState(ownerId);
        if (ownerState) {
          ownerState.dependencies.add(provider);
        }
        const targetState = this.getState(provider.id);
        if (targetState) {
          targetState.dependents.add(ownerId);

          if (select) {
            if (!targetState.watchSelectors) targetState.watchSelectors = new Map();
            let selectors = targetState.watchSelectors.get(ownerId);
            
            // If it's already null, it means there's an unconditional watch somewhere,
            // so we don't need to track selective watches anymore.
            if (selectors !== null) {
              if (!selectors) {
                selectors = [];
                targetState.watchSelectors.set(ownerId, selectors);
              }
              selectors.push({ selector: select as (val: unknown) => unknown, lastValue: selectedValue });
            }
          } else {
            // Unconditional watch
            if (!targetState.watchSelectors) targetState.watchSelectors = new Map();
            targetState.watchSelectors.set(ownerId, null);
          }
        }

        return selectedValue;
      },

      read: <T>(provider: ProviderBase<T>): T => {
        this.providerMap.set(provider.id, provider);
        return this.ensureInitialized(provider) as T;
      },

      listen: <T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe => {
        return this.listen(provider, callback);
      },

      onDispose: (callback: () => void): void => {
        const state = this.getState(ownerId);
        state?.disposeCallbacks.push(callback);
      },

      onCancel: (callback: () => void): void => {
        const state = this.getState(ownerId);
        state?.cancelCallbacks.push(callback);
      },

      onResume: (callback: () => void): void => {
        const state = this.getState(ownerId);
        state?.resumeCallbacks.push(callback);
      },

      invalidateSelf: (): void => {
        const provider = this.providerMap.get(ownerId);
        if (provider) this.invalidate(provider);
      },
    };
  }

  // ── Auto-dispose ─────────────────────────────────────────────

  private checkAutoDispose(provider: ProviderBase): void {
    const state = this.getState(provider.id);
    if (!state) return;
    const hasListeners = this.hasListeners(state);

    if (!hasListeners) {
      // Fire cancel callbacks
      for (const cb of Array.from(state.cancelCallbacks)) cb();

      // Auto-dispose if configured
      if (provider.options.autoDispose) {
        const cacheTime = provider.options.cacheTime;
        if (cacheTime !== undefined && cacheTime > 0) {
          state.disposeTimeout = setTimeout(() => {
            const currentState = this.getState(provider.id);
            if (currentState && !this.hasListeners(currentState)) {
              this.disposeProvider(provider);
            }
          }, cacheTime);
        } else {
          // Use microtask to allow re-subscription during the same tick
          queueMicrotask(() => {
            const currentState = this.getState(provider.id);
            if (currentState && !this.hasListeners(currentState)) {
              this.disposeProvider(provider);
            }
          });
        }
      }
    }
  }

  private disposeProvider(provider: ProviderBase): void {
    const state = this.getState(provider.id);
    if (!state) return;

    this.disposeState(provider.id, state);
    this.states.delete(provider.id);
    this.notifyObservers('dispose', provider);
  }

  private disposeState(id: symbol, state: ProviderState): void {
    if (state.disposeTimeout) {
      clearTimeout(state.disposeTimeout);
      state.disposeTimeout = undefined;
    }

    // Run dispose callbacks
    for (const cb of Array.from(state.disposeCallbacks)) {
      try {
        cb();
      } catch {
        // swallow
      }
    }

    // Abort async operations
    state.abortController?.abort();

    // Remove from dependency graph
    for (const depProvider of Array.from(state.dependencies)) {
      const depState = this.getState(depProvider.id);
      depState?.dependents.delete(id);
      depState?.watchSelectors?.delete(id);
      this.checkAutoDispose(depProvider);
    }

    state.snapshotListeners.clear();
    state.valueListeners.clear();
    state.dependencies.clear();
    state.dependents.clear();
    state.initialized = false;
  }

  // ── Observer notifications ───────────────────────────────────

  private notifyObservers(
    event: 'create' | 'update' | 'dispose' | 'error',
    provider: ProviderBase,
    ...args: unknown[]
  ): void {
    for (const observer of this.observers) {
      try {
        switch (event) {
          case 'create':
            observer.onProviderCreate?.(provider, args[0]);
            break;
          case 'update':
            observer.onProviderUpdate?.(provider, args[1], args[0]);
            break;
          case 'dispose':
            observer.onProviderDispose?.(provider);
            break;
          case 'error':
            observer.onProviderError?.(provider, args[0]);
            break;
        }
      } catch {
        // Observer errors should not break the container
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private hasListeners(state: ProviderState): boolean {
    return state.snapshotListeners.size > 0 || state.valueListeners.size > 0 || state.dependents.size > 0;
  }

  private getState(id: symbol): ProviderState | undefined {
    return this.states.get(id) ?? this.parent?.getState(id);
  }

  private createState(): ProviderState {
    return {
      value: undefined,
      previousValue: undefined,
      version: 0,
      snapshotListeners: new Set(),
      valueListeners: new Set(),
      dependencies: new Set(),
      dependents: new Set(),
      disposeCallbacks: [],
      cancelCallbacks: [],
      resumeCallbacks: [],
      disposeTimeout: undefined,
      initialized: false,
    };
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed RiverContainer.');
    }
  }
}
