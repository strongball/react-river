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

function nextId(name: string): symbol {
  // Use Symbol.for() for named providers so the same name always yields the
  // same Symbol identity.  This is critical for HMR: when a module re-executes,
  // the provider object is recreated but its Symbol id stays identical, so
  // container overrides (keyed by Symbol) remain valid.
  return Symbol.for(`river:${name}`);
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
  return {
    id: nextId(options.name),
    kind: 'provider',
    name: options.name,
    options,
    _create: create,
  };
}

// ── stateProvider() — Simple mutable state ─────────────────────

export function stateProvider<T>(create: (ref: Ref) => T, options: ProviderOptions<T>): StateProvider<T> {
  const id = nextId(options.name);

  const notifier = createNotifierAccessor<StateController<T>>(id, options);

  const stateP: StateProvider<T> = {
    id,
    kind: 'stateProvider',
    name: options.name,
    options,
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
  const id = nextId(options.name);

  const promiseP = {
    id,
    kind: 'promiseProvider',
    name: options.name,
    options,
    _create: create,
  } as unknown as PromiseProvider<T>;

  (promiseP as any).promise = createPromiseAccessor(id, promiseP, options);
  return promiseP;
}

// ── observableProvider() — Observable / Data source ──────────

export function observableProvider<T>(
  create: (ref: Ref) => ObservableLike<T> | Promise<ObservableLike<T>>,
  options: ProviderOptions<T>,
): ObservableProvider<T> {
  const id = nextId(options.name);

  const obsP = {
    id,
    kind: 'observableProvider',
    name: options.name,
    options,
    _create: create,
  } as unknown as ObservableProvider<T>;

  (obsP as any).promise = createPromiseAccessor(id, obsP, options);
  return obsP;
}

// ── notifierProvider() — Class-based synchronous state ─────────

export function notifierProvider<N extends Notifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions<N extends Notifier<infer T> ? T : unknown>,
): NotifierProvider<N, N extends Notifier<infer T> ? T : unknown> {
  const id = nextId(options.name);

  const notifier = createNotifierAccessor<N>(id, options);

  const notifierP: NotifierProvider<N, any> = {
    id,
    kind: 'notifierProvider',
    name: options.name,
    options,
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
  const id = nextId(options.name);

  const notifier = createNotifierAccessor<N>(id, options);

  const asyncP = {
    id,
    kind: 'asyncNotifierProvider',
    name: options.name,
    options,
    _createNotifier: createNotifier,
    notifier,
  } as unknown as AsyncNotifierProvider<N, any>;

  (asyncP as any).promise = createPromiseAccessor(id, asyncP, options);
  (notifier as any)._parentProvider = asyncP;
  return asyncP;
}
