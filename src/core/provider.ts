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
  ProviderOptions,
  Ref,
  StateController,
  StateProvider,
  StreamProvider,
} from './types';

// ── Internal ID counter for debugging ──────────────────────────

let providerCount = 0;
function nextId(name?: string): symbol {
  return Symbol(name ?? `provider_${++providerCount}`);
}

function normalizeOptions(options: ProviderOptions = {}): ProviderOptions {
  return {
    autoDispose: true,
    cacheTime: 0,
    ...options,
  };
}

// ── provider() — Read-only computed value ──────────────────────

export function provider<T>(create: (ref: Ref) => T, options: ProviderOptions = {}): Provider<T> {
  const normOptions = normalizeOptions(options);
  return {
    id: nextId(options.name),
    kind: 'provider',
    name: normOptions.name,
    options: normOptions,
    _create: create,
  };
}

// ── stateProvider() — Simple mutable state ─────────────────────

export function stateProvider<T>(create: (ref: Ref) => T, options: ProviderOptions = {}): StateProvider<T> {
  const normOptions = normalizeOptions(options);
  const id = nextId(normOptions.name);

  const notifierAccessor: NotifierAccessor<StateController<T>> = {
    id: Symbol(`${normOptions.name ?? id.description}.notifier`),
    kind: 'notifierAccessor',
    name: normOptions.name ? `${normOptions.name}.notifier` : undefined,
    options: normOptions,
    _parentId: id,
  };

  const provider: StateProvider<T> = {
    id,
    kind: 'stateProvider',
    name: normOptions.name,
    options: normOptions,
    _create: create,
    notifier: notifierAccessor,
  };
  (notifierAccessor as any)._parentProvider = provider;
  return provider;
}

// ── promiseProvider() — Async data source ───────────────────────

export function promiseProvider<T>(
  create: (ref: Ref) => Promise<T>,
  options: ProviderOptions = {},
): PromiseProvider<T> {
  const normOptions = normalizeOptions(options);
  return {
    id: nextId(normOptions.name),
    kind: 'promiseProvider',
    name: normOptions.name,
    options: normOptions,
    _create: create,
  };
}

// ── streamProvider() — Observable / AsyncIterable data source ──

export function streamProvider<T>(
  create: (ref: Ref) => AsyncIterable<T>,
  options: ProviderOptions = {},
): StreamProvider<T> {
  const normOptions = normalizeOptions(options);
  return {
    id: nextId(normOptions.name),
    kind: 'streamProvider',
    name: normOptions.name,
    options: normOptions,
    _create: create,
  };
}

// ── notifierProvider() — Class-based synchronous state ─────────

export function notifierProvider<N extends Notifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions = {},
): NotifierProvider<N, N extends Notifier<infer T> ? T : unknown> {
  const normOptions = normalizeOptions(options);
  const id = nextId(normOptions.name);

  const notifierAccessor: NotifierAccessor<N> = {
    id: Symbol(`${normOptions.name ?? id.description}.notifier`),
    kind: 'notifierAccessor',
    name: normOptions.name ? `${normOptions.name}.notifier` : undefined,
    options: normOptions,
    _parentId: id,
  };

  const provider: NotifierProvider<N, any> = {
    id,
    kind: 'notifierProvider',
    name: normOptions.name,
    options: normOptions,
    _createNotifier: createNotifier,
    notifier: notifierAccessor,
  };
  (notifierAccessor as any)._parentProvider = provider;
  return provider;
}

// ── asyncNotifierProvider() — Class-based async state ──────────

export function asyncNotifierProvider<N extends AsyncNotifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions = {},
): AsyncNotifierProvider<N, N extends AsyncNotifier<infer T> ? T : unknown> {
  const normOptions = normalizeOptions(options);
  const id = nextId(normOptions.name);

  const notifierAccessor: NotifierAccessor<N> = {
    id: Symbol(`${normOptions.name ?? id.description}.notifier`),
    kind: 'notifierAccessor',
    name: normOptions.name ? `${normOptions.name}.notifier` : undefined,
    options: normOptions,
    _parentId: id,
  };

  const provider: AsyncNotifierProvider<N, any> = {
    id,
    kind: 'asyncNotifierProvider',
    name: normOptions.name,
    options: normOptions,
    _createNotifier: createNotifier,
    notifier: notifierAccessor,
  };
  (notifierAccessor as any)._parentProvider = provider;
  return provider;
}
