/* ════════════════════════════════════════════════════════════════
 *  React River — Provider Initializers
 *  Standalone initialization functions for each provider kind.
 *  Kept separate from the container class for readability.
 * ════════════════════════════════════════════════════════════════ */

import { asyncData, asyncError, asyncLoading } from './async_value';

import type { AsyncValue } from './async_value';
import type { Notifier, AsyncNotifier } from './notifier';
import type { ProviderState, ContainerCallbacks } from './container_types';
import type {
  PromiseProvider,
  NotifierAccessor,
  ProviderBase,
  ProviderOverride,
  Ref,
  StateController,
  StateProvider,
  ObservableProvider,
  ObservableLike,
} from './types';

// ── Simple Provider ────────────────────────────────────────────

export function initSimpleProvider(options: {
  cb: ContainerCallbacks;
  provider: ProviderBase<any>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
}): void {
  const { provider, ref, state, override, hydratedValue } = options;
  const p = provider as any;
  const createFn = override ? override.create : p._create;
  // ALWAYS execute the factory to build dependencies (e.g. ref.watch)
  const initialValue = createFn(ref);
  // OVERRIDE with hydrated value if it exists
  state.value = hydratedValue !== undefined ? hydratedValue : initialValue;
}

// ── State Provider ─────────────────────────────────────────────

export function initStateProvider(options: {
  cb: ContainerCallbacks;
  provider: StateProvider<unknown>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
}): void {
  const { cb, provider, ref, state, override, hydratedValue } = options;
  const createFn = override ? override.create : provider._create;
  // ALWAYS execute the factory to build dependencies (e.g. ref.watch)
  const initialValue = createFn(ref);
  // OVERRIDE with hydrated value if it exists
  state.value = hydratedValue !== undefined ? hydratedValue : initialValue;

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
      cb.updateValue(provider.id, newValue);
    },
  };
  state.notifierInstance = controller;
}

// ── Promise Provider ───────────────────────────────────────────

export function initPromiseProvider(options: {
  cb: ContainerCallbacks;
  provider: PromiseProvider<unknown>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
  previousValue?: unknown;
}): void {
  const { cb, provider, ref, state, override, hydratedValue, previousValue } = options;
  const prevData =
    previousValue && typeof previousValue === 'object' && 'status' in previousValue
      ? (previousValue as any).data
      : undefined;
  // Use hydrated value (wrapped in asyncData) instead of asyncLoading when available.
  // The client-side factory still executes and will update the value when fresh data arrives.
  state.value = hydratedValue !== undefined ? asyncData(hydratedValue) : asyncLoading(prevData);

  const abortController = new AbortController();
  state.abortController = abortController;

  const promise = (override ? override.create(ref) : provider._create(ref)) as Promise<unknown>;

  promise.then(
    (data) => {
      if (abortController.signal.aborted) return;
      cb.updateValue(provider.id, asyncData(data));
    },
    (error) => {
      if (abortController.signal.aborted) return;
      cb.notifyObservers('error', provider, error);
      cb.updateValue(provider.id, asyncError(error));
    },
  );
}

// ── Observable Provider ────────────────────────────────────────

export function initObservableProvider(options: {
  cb: ContainerCallbacks;
  provider: ObservableProvider<unknown>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
  previousValue?: unknown;
}): void {
  const { cb, provider, ref, state, override, hydratedValue, previousValue } = options;
  const prevData =
    previousValue && typeof previousValue === 'object' && 'status' in previousValue
      ? (previousValue as any).data
      : undefined;
  // Use hydrated value (wrapped in asyncData) instead of asyncLoading when available.
  state.value = hydratedValue !== undefined ? asyncData(hydratedValue) : asyncLoading(prevData);

  const abortController = new AbortController();
  state.abortController = abortController;

  const result = override
    ? (override.create(ref) as ObservableLike<unknown> | Promise<ObservableLike<unknown>>)
    : provider._create(ref);

  const subscribe = (obs: ObservableLike<unknown>) => {
    if (abortController.signal.aborted) return;
    const subscription = obs.subscribe({
      next: (data) => {
        if (abortController.signal.aborted) return;
        cb.updateValue(provider.id, asyncData(data));
      },
      error: (error) => {
        if (abortController.signal.aborted) return;
        cb.notifyObservers('error', provider, error);
        cb.updateValue(provider.id, asyncError(error));
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
        cb.notifyObservers('error', provider, error);
        cb.updateValue(provider.id, asyncError(error));
      },
    );
  } else {
    subscribe(result);
  }
}

// ── Notifier Provider ──────────────────────────────────────────

export function initNotifierProvider(options: {
  cb: ContainerCallbacks;
  provider: ProviderBase<any>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
}): void {
  const { cb, provider, ref, state, override, hydratedValue } = options;
  if (override) {
    const initialValue = override.create(ref);
    state.value = hydratedValue !== undefined ? hydratedValue : initialValue;
    return;
  }

  const p = provider as unknown as {
    _createNotifier: () => Notifier<unknown>;
  };
  const notifier = p._createNotifier();
  notifier._ref = ref;
  notifier._setState = (value: unknown) => {
    notifier._state = value;
    cb.updateValue(provider.id, value);
  };

  const initialValue = notifier.build();
  // Use hydrated value as the initial state if available, otherwise use build() result.
  // The notifier instance is still created so client-side mutations work.
  const effectiveValue = hydratedValue !== undefined ? hydratedValue : initialValue;
  notifier._state = effectiveValue;
  state.value = effectiveValue;
  state.notifierInstance = notifier;
}

// ── Async Notifier Provider ────────────────────────────────────

export function initAsyncNotifierProvider(options: {
  cb: ContainerCallbacks;
  provider: ProviderBase<any>;
  ref: Ref;
  state: ProviderState;
  override?: ProviderOverride;
  hydratedValue?: unknown;
  previousValue?: unknown;
}): void {
  const { cb, provider, ref, state, override, hydratedValue, previousValue } = options;
  const prevData =
    previousValue && typeof previousValue === 'object' && 'status' in previousValue
      ? (previousValue as any).data
      : undefined;
  // Use hydrated value (wrapped in asyncData) instead of asyncLoading when available.
  state.value = hydratedValue !== undefined ? asyncData(hydratedValue) : asyncLoading(prevData);

  const abortController = new AbortController();
  state.abortController = abortController;

  if (override) {
    const promise = override.create(ref) as Promise<unknown>;
    promise.then(
      (data) => {
        if (abortController.signal.aborted) return;
        cb.updateValue(provider.id, asyncData(data));
      },
      (error) => {
        if (abortController.signal.aborted) return;
        cb.notifyObservers('error', provider, error);
        cb.updateValue(provider.id, asyncError(error));
      },
    );
    return;
  }

  const p = provider as unknown as {
    _createNotifier: () => AsyncNotifier<unknown>;
  };
  const notifier = p._createNotifier();
  notifier._ref = ref;
  notifier._setState = (value: AsyncValue<unknown>) => {
    notifier._state = value;
    cb.updateValue(provider.id, value);
  };

  notifier._state = state.value as AsyncValue<unknown>;
  state.notifierInstance = notifier;

  notifier.build().then(
    (data) => {
      if (abortController.signal.aborted) return;
      const asyncVal = asyncData(data);
      notifier._state = asyncVal;
      cb.updateValue(provider.id, asyncVal);
    },
    (error) => {
      if (abortController.signal.aborted) return;
      cb.notifyObservers('error', provider, error);
      const asyncVal = asyncError(error);
      notifier._state = asyncVal;
      cb.updateValue(provider.id, asyncVal);
    },
  );
}

// ── Notifier Accessor ──────────────────────────────────────────

export function initNotifierAccessor(options: {
  cb: ContainerCallbacks;
  accessor: NotifierAccessor<unknown>;
  state: ProviderState;
}): void {
  const { cb, accessor, state } = options;
  const parentId = accessor._parentId;
  let parentProvider = cb.providerMap.get(parentId);

  if (!parentProvider && accessor._parentProvider) {
    parentProvider = accessor._parentProvider;
    cb.providerMap.set(parentId, parentProvider);
  }

  if (parentProvider) {
    cb.ensureInitialized(parentProvider);
  }
  const parentState = cb.getState(parentId);
  if (!parentState) {
    throw new Error(
      `Parent provider not found for notifier accessor: ${accessor.name ?? accessor.id.description}`,
    );
  }
  state.value = parentState.notifierInstance;

  // Register dependency so that invalidating the parent notifier correctly
  // invalidates and re-initializes this accessor to point to the new notifier instance.
  if (parentProvider) {
    parentState.dependents.add(accessor.id);
    state.dependencies.add(parentProvider);
  }
}
