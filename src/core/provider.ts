/* ════════════════════════════════════════════════════════════════
 *  React River — Provider Factory Functions
 *  Create provider definitions (descriptions, not state).
 * ════════════════════════════════════════════════════════════════ */

import type { AsyncNotifier, Notifier } from './notifier';
import type {
  AsyncNotifierProvider,
  PromiseProvider,
  NotifierAccessor,
  NotifierProvider,
  Provider,
  ProviderBase,
  ProviderOptions,
  PromiseAccessor,
  Ref,
  StateController,
  StateProvider,
  ObservableProvider,
  ObservableLike,
} from './types';
import type { AsyncValue } from './async_value';

// ── Internal ID counter for debugging ──────────────────────────

let providerCount = 0;
function nextId(name?: string): symbol {
  // Use Symbol.for() for named providers so the same name always yields the
  // same Symbol identity.  This is critical for HMR: when a module re-executes,
  // the provider object is recreated but its Symbol id stays identical, so
  // container overrides (keyed by Symbol) remain valid.
  return name ? Symbol.for(`river:${name}`) : Symbol(`provider_${++providerCount}`);
}



// ── Sub-provider factories ─────────────────────────────────────

function createNotifierAccessor<N>(
  parentId: symbol,
  options: ProviderOptions<any>,
): NotifierAccessor<N> {
  const name = `${options.name}.notifier`;
  return {
    id: Symbol.for(`river:${name}`),
    kind: 'notifierAccessor',
    name,
    options: { ...options, name } as ProviderOptions<N>,
    _parentId: parentId,
  } as NotifierAccessor<N>;
}

function createPromiseAccessor<T>(
  parentId: symbol,
  parentProvider: ProviderBase<AsyncValue<T>>,
  options: ProviderOptions<T>,
): PromiseAccessor<T> {
  const name = `${options.name}.promise`;
  return {
    id: Symbol.for(`river:${name}`),
    kind: 'promiseAccessor',
    name,
    options: { ...options, name } as ProviderOptions<Promise<T>>,
    _parentId: parentId,
    _parentProvider: parentProvider,
  } as PromiseAccessor<T>;
}

// ── provider() — Read-only computed value ──────────────────────

export function provider<T>(create: (ref: Ref) => T, options: ProviderOptions<T>): Provider<T> {
  const opts = options || ({ name: `unnamed_provider_${++providerCount}` } as any);
  return {
    id: nextId(opts.name),
    kind: 'provider',
    name: opts.name,
    options: opts,
    _create: create,
  };
}

// ── stateProvider() — Simple mutable state ─────────────────────

export function stateProvider<T>(create: (ref: Ref) => T, options: ProviderOptions<T>): StateProvider<T> {
  const opts = options || ({ name: `unnamed_state_${++providerCount}` } as any);
  const id = nextId(opts.name);

  const notifier = createNotifierAccessor<StateController<T>>(id, opts);

  const stateP: StateProvider<T> = {
    id,
    kind: 'stateProvider',
    name: opts.name,
    options: opts,
    _create: create,
    notifier,
  };
  (notifier as any)._parentProvider = stateP;
  return stateP;
}

// ── promiseProvider() — Async data source ───────────────────────

export function promiseProvider<T>(
  create: (ref: Ref) => Promise<T>,
  options: ProviderOptions<T>,
): PromiseProvider<T> {
  const opts = options || ({ name: `unnamed_promise_${++providerCount}` } as any);
  const id = nextId(opts.name);

  const promiseP = {
    id,
    kind: 'promiseProvider',
    name: opts.name,
    options: opts,
    _create: create,
  } as unknown as PromiseProvider<T>;

  (promiseP as any).promise = createPromiseAccessor(id, promiseP, opts);
  return promiseP;
}

// ── observableProvider() — Observable / Data source ──────────

export function observableProvider<T>(
  create: (ref: Ref) => ObservableLike<T> | Promise<ObservableLike<T>>,
  options: ProviderOptions<T>,
): ObservableProvider<T> {
  const opts = options || ({ name: `unnamed_obs_${++providerCount}` } as any);
  const id = nextId(opts.name);

  const obsP = {
    id,
    kind: 'observableProvider',
    name: opts.name,
    options: opts,
    _create: create,
  } as unknown as ObservableProvider<T>;

  (obsP as any).promise = createPromiseAccessor(id, obsP, opts);
  return obsP;
}

// ── notifierProvider() — Class-based synchronous state ─────────

export function notifierProvider<N extends Notifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions<N extends Notifier<infer T> ? T : unknown>,
): NotifierProvider<N, N extends Notifier<infer T> ? T : unknown> {
  const opts = options || ({ name: `unnamed_notifier_${++providerCount}` } as any);
  const id = nextId(opts.name);

  const notifier = createNotifierAccessor<N>(id, opts);

  const notifierP: NotifierProvider<N, any> = {
    id,
    kind: 'notifierProvider',
    name: opts.name,
    options: opts,
    _createNotifier: createNotifier,
    notifier,
  };
  (notifier as any)._parentProvider = notifierP;
  return notifierP;
}

// ── asyncNotifierProvider() — Class-based async state ──────────

export function asyncNotifierProvider<N extends AsyncNotifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions<N extends AsyncNotifier<infer T> ? T : unknown>,
): AsyncNotifierProvider<N, N extends AsyncNotifier<infer T> ? T : unknown> {
  const opts = options || ({ name: `unnamed_async_${++providerCount}` } as any);
  const id = nextId(opts.name);

  const notifier = createNotifierAccessor<N>(id, opts);

  const asyncP = {
    id,
    kind: 'asyncNotifierProvider',
    name: opts.name,
    options: opts,
    _createNotifier: createNotifier,
    notifier,
  } as unknown as AsyncNotifierProvider<N, any>;

  (asyncP as any).promise = createPromiseAccessor(id, asyncP, opts);
  (notifier as any)._parentProvider = asyncP;
  return asyncP;
}
