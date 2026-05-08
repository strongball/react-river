/* ════════════════════════════════════════════════════════════════
 *  React River — RiverContainer
 *  The core state container — stores, tracks, and manages all
 *  provider states. Framework-agnostic (no React dependency).
 * ════════════════════════════════════════════════════════════════ */

import { asyncValueEquals, asyncValueToPromise } from './async_value';
import { createProviderState, type RiverCachePolicy } from './container_types';
import {
  initSimpleProvider,
  initStateProvider,
  initPromiseProvider,
  initObservableProvider,
  initNotifierProvider,
  initAsyncNotifierProvider,
  initNotifierAccessor,
} from './initializers';
import { createRef } from './ref_factory';
import { validateSerializable, isSerializable } from './serialization';
import {
  getProviderLabel,
  type ListenerCallback,
  type NotifierAccessor,
  type PromiseAccessor,
  type ProviderBase,
  type ProviderOverride,
  type StateProvider,
  type PromiseProvider,
  type ObservableProvider,
  type Unsubscribe,
} from './types';

import type { AsyncData, AsyncValue } from './async_value';
import type { ProviderState, ContainerCallbacks } from './container_types';
import type { RiverObserver } from './observer';

// Re-export public types so existing imports keep working
export type { DevToolsProviderSnapshot, RiverContainerOptions, RiverCachePolicy } from './container_types';

// ── RiverContainer ─────────────────────────────────────────────

export class RiverContainer {
  private states = new Map<symbol, ProviderState>();
  private overrideMap = new Map<symbol, ProviderOverride>();
  providerMap = new Map<symbol, ProviderBase<any>>();
  private initializingStack = new Set<symbol>();
  private parent: RiverContainer | undefined;
  private observers: RiverObserver[];
  public disposed = false;

  /** SSR hydration state: provider name → pre-computed value. */
  private initialState: Record<string, unknown> | undefined;

  /** Default auto-dispose and cache-time policy for providers in this scope. */
  private readonly cachePolicy: Required<RiverCachePolicy>;

  /** Bound callbacks passed to extracted initializer / ref-factory modules. */
  private readonly cb: ContainerCallbacks;

  constructor(
    options: {
      parent?: RiverContainer;
      overrides?: ProviderOverride[];
      observers?: RiverObserver[];
      cachePolicy?: RiverCachePolicy;
      initialState?: Record<string, unknown>;
    } = {},
  ) {
    this.parent = options.parent;
    this.observers = options.observers ?? [];
    this.cachePolicy = { autoDispose: true, cacheTime: 60000, ...options.cachePolicy };
    this.initialState = options.initialState;

    if (options.overrides) {
      for (const override of options.overrides) {
        this.overrideMap.set(override.original.id, override);
      }
    }

    this.cb = {
      updateValue: this.updateValue.bind(this),
      notifyObservers: this.notifyObservers.bind(this),
      getState: this.getState.bind(this),
      ensureInitialized: this.ensureInitialized.bind(this),
      listen: this.listen.bind(this),
      read: this.read.bind(this),
      invalidate: this.invalidate.bind(this),
      providerMap: this.providerMap,
    };
  }

  // ── Observers ────────────────────────────────────────────────

  addObserver(observer: RiverObserver): void {
    this.observers.push(observer);
  }

  removeObserver(observer: RiverObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  // ── Public API ───────────────────────────────────────────────

  /** Read a provider's current value (initializes lazily). */
  read<T>(provider: ProviderBase<T>): T {
    this.assertNotDisposed();
    return this.ensureInitialized(provider) as T;
  }

  /**
   * Subscribe to snapshot changes (for useSyncExternalStore).
   * Callback receives no arguments — just a notification.
   */
  subscribe(provider: ProviderBase<any>, callback: () => void): Unsubscribe {
    return this.addListener(provider, callback, (s) => s.snapshotListeners);
  }

  /**
   * Listen to value changes with next/prev callback.
   * Does NOT trigger component re-renders.
   */
  listen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe {
    return this.addListener(provider, callback as ListenerCallback<unknown>, (s) => s.valueListeners);
  }

  /** Force a provider to re-initialize. */
  invalidate(provider: ProviderBase<any>): void {
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

    if (provider.options.global && this.parent) {
      this.getRootContainer().set(provider, value);
      return;
    }

    this.ensureInitialized(provider);

    const state = this.getOwnState(provider.id)!;
    const current = state.value as T;
    const newValue = typeof value === 'function' ? (value as (prev: T) => T)(current) : value;

    this.updateValue(provider.id, newValue);
  }

  /** Dispose the container and all provider states. */
  dispose(): void {
    for (const [id, state] of this.states) {
      if (state.initialized) {
        const provider = this.providerMap.get(id);
        this.teardownState(id, state, { clearListeners: true, cascadeAutoDispose: false });
        if (provider) {
          this.notifyObservers('dispose', provider);
        }
      }
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
  getProviderStates(): import('./container_types').DevToolsProviderSnapshot[] {
    const snapshots: import('./container_types').DevToolsProviderSnapshot[] = [];

    for (const [id, state] of this.states) {
      if (!state.initialized) continue;

      const provider = this.providerMap.get(id);
      if (!provider) continue;

      snapshots.push({
        id,
        name: getProviderLabel(provider),
        kind: provider.kind,
        value: state.value,
        previousValue: state.previousValue,
        version: state.version,
        initialized: state.initialized,
        listenerCount: state.snapshotListeners.size + state.valueListeners.size,
        dependencyCount: state.dependencies.size,
        dependentCount: state.dependents.size,
        dependencies: Array.from(state.dependencies).map(getProviderLabel),
        dependents: Array.from(state.dependents).map((sym) => {
          const p = this.providerMap.get(sym);
          return p ? getProviderLabel(p) : (sym.description ?? 'unknown');
        }),
        autoDispose: state.autoDispose,
        cacheTime: state.cacheTime,
      });
    }

    return snapshots;
  }

  /**
   * Export the current state of all **named** providers as a serializable object.
   * Use this on the server after rendering to produce the hydration payload.
   *
   * For async providers, if the value is an `AsyncData`, the inner `data` is exported.
   * Loading / error states are omitted.
   *
   * @example
   * ```ts
   * const container = new RiverContainer();
   * // ... render on server, providers get initialized ...
   * const state = container.dehydrate();
   * // => { 'userProfile': { id: 1, name: 'John' }, 'themeMode': 'dark' }
   * ```
   */
  dehydrate(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [id, state] of this.states) {
      if (!state.initialized) continue;

      const provider = this.providerMap.get(id);
      if (!provider?.name) continue;

      const { ssr, toJSON } = provider.options;

      // Explicitly opted out of SSR
      if (ssr === false) continue;

      const value = state.value;
      let exportValue: unknown;

      // Determine if we are dealing with an async provider based on its kind.
      const isAsyncKind =
        provider.kind === 'promiseProvider' ||
        provider.kind === 'observableProvider' ||
        provider.kind === 'asyncNotifierProvider';

      if (isAsyncKind) {
        const asyncVal = value as import('./async_value').AsyncValue<unknown>;
        if (asyncVal.status === 'data') {
          exportValue = (asyncVal as import('./async_value').AsyncData<unknown>).data;
        } else {
          // Skip loading / error states — nothing useful to hydrate
          continue;
        }
      } else {
        exportValue = value;
      }

      // Apply custom toJSON if provided, then validate the transformed output
      if (toJSON) {
        exportValue = toJSON(exportValue);
      }

      // Validate and export
      if (isSerializable(exportValue)) {
        result[provider.name] = exportValue;
      } else if (process.env.NODE_ENV !== 'production') {
        validateSerializable(exportValue, provider.name);
      }
    }

    return result;
  }

  // ── Listener management ──────────────────────────────────────

  private addListener<TCallback>(
    provider: ProviderBase<any>,
    callback: TCallback,
    getSet: (state: ProviderState) => Set<TCallback>,
  ): Unsubscribe {
    this.assertNotDisposed();
    this.ensureInitialized(provider);

    const state = this.getState(provider.id)!;
    const hadListeners = this.hasListeners(state);

    getSet(state).add(callback);

    // If transitioning from 0 → 1 listeners, fire resume
    if (!hadListeners) {
      if (state.disposeTimeout) {
        clearTimeout(state.disposeTimeout);
        state.disposeTimeout = undefined;
      }
      for (const cb of state.resumeCallbacks) cb();
    }

    return () => {
      getSet(state).delete(callback);
      this.checkAutoDispose(provider);
    };
  }

  // ── Initialization ───────────────────────────────────────────

  private ensureInitialized(provider: ProviderBase<any>): unknown {
    // Register provider for reverse lookup (DevTools, dependency graph)
    this.providerMap.set(provider.id, provider);

    // If the provider is marked as global, delegate to the root container
    if (provider.options.global && this.parent) {
      return this.getRootContainer().ensureInitialized(provider);
    }

    // promiseAccessor is stateless — computed on the fly from the parent's AsyncValue.
    if (provider.kind === 'promiseAccessor') {
      return this.resolvePromiseAccessor(provider as PromiseAccessor<unknown>);
    }
    // Check for override
    const override = this.overrideMap.get(provider.id);

    // Check if already initialized in this container
    const localState = this.states.get(provider.id);
    if (localState?.initialized) return localState.value;

    // Non-global (default): always create a new instance in the current container
    return this.initializeProvider(provider, override);
  }

  private resolvePromiseAccessor(accessor: PromiseAccessor<unknown>): Promise<unknown> {
    const parentProvider = accessor._parentProvider;
    const parentValue = this.read(parentProvider) as AsyncValue<unknown>;
    if (!parentValue) return new Promise(() => {});

    return asyncValueToPromise(
      parentValue,
      (av) => (av as AsyncData<unknown>).data,
      (onNext) => this.listen(parentProvider, (next) => onNext(next as AsyncValue<unknown>)),
    );
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

  private initializeProvider(provider: ProviderBase<any>, override?: ProviderOverride): unknown {
    // Circular dependency detection
    if (this.initializingStack.has(provider.id)) {
      throw new Error(
        `Circular dependency detected when initializing provider: ${provider.name ?? provider.id.description}`,
      );
    }
    this.initializingStack.add(provider.id);

    const state = createProviderState();
    // Resolve effective autoDispose / cacheTime: provider option → scope cachePolicy (includes built-in defaults)
    state.autoDispose = provider.options.autoDispose ?? this.cachePolicy.autoDispose;
    state.cacheTime = provider.options.cacheTime ?? this.cachePolicy.cacheTime;
    this.states.set(provider.id, state);

    const ref = createRef(this.cb, provider.id);

    // Resolve hydrated value from SSR initialState (only for named providers).
    // Once consumed, the key is deleted so re-initialization (refresh/invalidate)
    // will use the factory instead of the stale hydrated value.
    let hydratedValue: unknown;
    if (provider.name && this.initialState && provider.name in this.initialState) {
      hydratedValue = this.initialState[provider.name];
      delete this.initialState[provider.name];
    }

    // Apply fromJSON transformation if configured
    if (hydratedValue !== undefined && provider.options.fromJSON) {
      hydratedValue = provider.options.fromJSON(hydratedValue);
    }

    try {
      switch (provider.kind) {
        case 'provider':
          initSimpleProvider(this.cb, provider, ref, state, override, hydratedValue);
          break;
        case 'stateProvider':
          initStateProvider(this.cb, provider as StateProvider<unknown>, ref, state, override, hydratedValue);
          break;
        case 'promiseProvider':
          initPromiseProvider(this.cb, provider as PromiseProvider<unknown>, ref, state, override, hydratedValue);
          break;
        case 'observableProvider':
          initObservableProvider(this.cb, provider as ObservableProvider<unknown>, ref, state, override, hydratedValue);
          break;
        case 'notifierProvider':
          initNotifierProvider(this.cb, provider, ref, state, override, hydratedValue);
          break;
        case 'asyncNotifierProvider':
          initAsyncNotifierProvider(this.cb, provider, ref, state, override, hydratedValue);
          break;
        case 'notifierAccessor':
          initNotifierAccessor(this.cb, provider as unknown as NotifierAccessor<unknown>, state);
          break;
        // promiseAccessor is handled in ensureInitialized/resolvePromiseAccessor
        // and never reaches initializeProvider.
        default:
          throw new Error(`Unknown provider kind: ${provider.kind}`);
      }

      state.initialized = true;
      this.notifyObservers('create', provider, state.value);
    } catch (error) {
      this.notifyObservers('error', provider, error);
      throw error;
    } finally {
      this.initializingStack.delete(provider.id);
    }

    return state.value;
  }

  // ── Value updates & notification ─────────────────────────────

  private updateValue(providerId: symbol, newValue: unknown): void {
    const state = this.getOwnState(providerId);
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
      this.notifyObservers('update', provider, { oldValue, newValue });
    }

    // Notify value listeners (next, prev) — Array.from needed: callbacks may unsubscribe
    for (const cb of Array.from(state.valueListeners)) {
      cb(newValue, oldValue);
    }

    // Notify snapshot listeners — safe to iterate directly (React useSyncExternalStore)
    for (const cb of state.snapshotListeners) {
      cb();
    }

    // Propagate to dependents
    this.propagateToDependents(providerId);
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
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
            let anyChanged = false;
            for (const item of selectors) {
              try {
                const newSelected = item.selector(state.value);
                if (!this.valuesEqual(item.lastValue, newSelected)) {
                  anyChanged = true;
                  break;
                }
              } catch {
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

  private reinitialize(provider: ProviderBase<any>): void {
    const state = this.getState(provider.id);
    if (!state?.initialized) return;

    const oldValue = state.value;

    // Teardown without clearing listeners or cascading auto-dispose
    this.teardownState(provider.id, state, { clearListeners: false, cascadeAutoDispose: false });

    // Remove from states so initializeProvider creates fresh
    this.states.delete(provider.id);

    // Re-initialize
    const override = this.overrideMap.get(provider.id);
    this.initializeProvider(provider, override);

    // Restore listeners and dependency graph
    const newState = this.getOwnState(provider.id)!;
    newState.snapshotListeners = state.snapshotListeners;
    newState.valueListeners = state.valueListeners;
    newState.dependents = state.dependents;
    newState.watchSelectors = state.watchSelectors;

    // Check if value actually changed
    if (!this.valuesEqual(oldValue, newState.value)) {
      newState.previousValue = oldValue;
      newState.version++;

      this.notifyObservers('update', provider, { oldValue, newValue: newState.value });

      for (const cb of Array.from(newState.valueListeners)) {
        cb(newState.value, oldValue);
      }
      for (const cb of newState.snapshotListeners) {
        cb();
      }

      this.propagateToDependents(provider.id);
    }
  }

  // ── Auto-dispose ─────────────────────────────────────────────

  private checkAutoDispose(provider: ProviderBase<any>): void {
    const state = this.getState(provider.id);
    if (!state || !state.initialized) return;

    if (!this.hasListeners(state)) {
      for (const cb of Array.from(state.cancelCallbacks)) cb();

      if (state.autoDispose) {
        if (state.cacheTime > 0) {
          state.disposeTimeout = setTimeout(() => {
            const currentState = this.getState(provider.id);
            if (currentState && !this.hasListeners(currentState)) {
              this.disposeProvider(provider);
            }
          }, state.cacheTime);
        } else {
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

  private disposeProvider(provider: ProviderBase<any>): void {
    const state = this.getOwnState(provider.id);
    if (!state || !state.initialized) return;

    this.teardownState(provider.id, state, { clearListeners: true, cascadeAutoDispose: true });
    this.states.delete(provider.id);
    this.notifyObservers('dispose', provider);
  }

  /**
   * Shared cleanup logic for both reinitialize and dispose.
   * Clears timeouts, runs dispose callbacks, aborts async ops, and removes dependency links.
   */
  private teardownState(
    id: symbol,
    state: ProviderState,
    opts: { clearListeners: boolean; cascadeAutoDispose: boolean },
  ): void {
    state.initialized = false;

    if (state.disposeTimeout) {
      clearTimeout(state.disposeTimeout);
      state.disposeTimeout = undefined;
    }

    for (const cb of Array.from(state.disposeCallbacks)) {
      try {
        cb();
      } catch {
        // Dispose callbacks should not throw
      }
    }

    state.abortController?.abort();

    for (const depProvider of Array.from(state.dependencies)) {
      const depState = this.getState(depProvider.id);
      depState?.dependents.delete(id);
      depState?.watchSelectors?.delete(id);
      if (opts.cascadeAutoDispose) {
        this.checkAutoDispose(depProvider);
      }
    }

    state.dependencies.clear();
    state.disposeCallbacks = [];
    state.cancelCallbacks = [];
    state.resumeCallbacks = [];
    state.abortController = undefined;

    if (opts.clearListeners) {
      state.snapshotListeners.clear();
      state.valueListeners.clear();
      state.dependents.clear();
    }
  }

  // ── Observer notifications ───────────────────────────────────

  private notifyObservers(event: 'create' | 'dispose' | 'error', provider: ProviderBase<any>, ...args: unknown[]): void;
  private notifyObservers(
    event: 'update',
    provider: ProviderBase<any>,
    payload: { oldValue: unknown; newValue: unknown },
  ): void;
  private notifyObservers(
    event: 'create' | 'update' | 'dispose' | 'error',
    provider: ProviderBase<any>,
    ...args: any[]
  ): void {
    for (const observer of this.observers) {
      try {
        switch (event) {
          case 'create':
            observer.onProviderCreate?.(provider, args[0]);
            break;
          case 'update':
            observer.onProviderUpdate?.(provider, args[0].oldValue, args[0].newValue);
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

  public getState(id: symbol): ProviderState | undefined {
    return this.states.get(id) ?? this.parent?.getState(id);
  }

  private getOwnState(id: symbol): ProviderState | undefined {
    return this.states.get(id);
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed RiverContainer.');
    }
  }
}
