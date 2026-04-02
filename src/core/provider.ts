/* ════════════════════════════════════════════════════════════════
 *  React River — Provider Factory Functions
 *  Create provider definitions (descriptions, not state).
 * ════════════════════════════════════════════════════════════════ */

import type { AsyncNotifier, Notifier } from "./notifier";
import type {
  AsyncNotifierProvider,
  FutureProvider,
  NotifierAccessor,
  NotifierProvider,
  Provider,
  ProviderOptions,
  Ref,
  StateController,
  StateProvider,
  StreamProvider,
} from "./types";

// ── Internal ID counter for debugging ──────────────────────────

let providerCount = 0;
function nextId(name?: string): symbol {
  return Symbol(name ?? `provider_${++providerCount}`);
}

// ── provider() — Read-only computed value ──────────────────────

export function provider<T>(create: (ref: Ref) => T, options: ProviderOptions = {}): Provider<T> {
  return {
    id: nextId(options.name),
    kind: "provider",
    name: options.name,
    options,
    _create: create,
  };
}

// ── stateProvider() — Simple mutable state ─────────────────────

export function stateProvider<T>(
  create: (ref: Ref) => T,
  options: ProviderOptions = {},
): StateProvider<T> {
  const id = nextId(options.name);

  const notifierAccessor: NotifierAccessor<StateController<T>> = {
    id: Symbol(`${options.name ?? id.description}.notifier`),
    kind: "notifierAccessor",
    name: options.name ? `${options.name}.notifier` : undefined,
    options,
    _parentId: id,
  };

  const provider: StateProvider<T> = {
    id,
    kind: "stateProvider",
    name: options.name,
    options,
    _create: create,
    notifier: notifierAccessor,
  };
  (notifierAccessor as any)._parentProvider = provider;
  return provider;
}

// ── futureProvider() — Async data source ───────────────────────

export function futureProvider<T>(
  create: (ref: Ref) => Promise<T>,
  options: ProviderOptions = {},
): FutureProvider<T> {
  return {
    id: nextId(options.name),
    kind: "futureProvider",
    name: options.name,
    options,
    _create: create,
  };
}

// ── streamProvider() — Observable / AsyncIterable data source ──

export function streamProvider<T>(
  create: (ref: Ref) => AsyncIterable<T>,
  options: ProviderOptions = {},
): StreamProvider<T> {
  return {
    id: nextId(options.name),
    kind: "streamProvider",
    name: options.name,
    options,
    _create: create,
  };
}

// ── notifierProvider() — Class-based synchronous state ─────────

export function notifierProvider<N extends Notifier<any>>(
  createNotifier: () => N,
  options: ProviderOptions = {},
): NotifierProvider<N, N extends Notifier<infer T> ? T : unknown> {
  const id = nextId(options.name);

  const notifierAccessor: NotifierAccessor<N> = {
    id: Symbol(`${options.name ?? id.description}.notifier`),
    kind: "notifierAccessor",
    name: options.name ? `${options.name}.notifier` : undefined,
    options,
    _parentId: id,
  };

  const provider: NotifierProvider<N, any> = {
    id,
    kind: "notifierProvider",
    name: options.name,
    options,
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
  const id = nextId(options.name);

  const notifierAccessor: NotifierAccessor<N> = {
    id: Symbol(`${options.name ?? id.description}.notifier`),
    kind: "notifierAccessor",
    name: options.name ? `${options.name}.notifier` : undefined,
    options,
    _parentId: id,
  };

  const provider: AsyncNotifierProvider<N, any> = {
    id,
    kind: "asyncNotifierProvider",
    name: options.name,
    options,
    _createNotifier: createNotifier,
    notifier: notifierAccessor,
  };
  (notifierAccessor as any)._parentProvider = provider;
  return provider;
}
