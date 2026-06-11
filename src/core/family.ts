/* ════════════════════════════════════════════════════════════════
 *  React River — Family Modifier
 *  Parameterized providers, analogous to Riverpod's .family.
 * ════════════════════════════════════════════════════════════════ */

import {
  asyncNotifierProvider,
  promiseProvider,
  notifierProvider,
  provider,
  stateProvider,
  observableProvider,
} from './provider';

import type { AsyncNotifier, Notifier } from './notifier';
import type {
  AsyncNotifierProvider,
  PromiseProvider,
  NotifierProvider,
  Provider,
  ProviderOptions,
  Ref,
  StateProvider,
  ObservableProvider,
  ObservableLike,
} from './types';

// ── Family types ───────────────────────────────────────────────

export interface ProviderFamily<P, Arg> {
  (arg: Arg): P;
  /** Clear all cached provider instances */
  clear(): void;
}

// ── Key serialization ──────────────────────────────────────────

function stableStringify(val: unknown): string {
  if (val === null) return 'null';
  if (typeof val === 'object') {
    if (typeof (val as any).toJSON === 'function') {
      return stableStringify((val as any).toJSON());
    }
    if (Array.isArray(val)) {
      return '[' + val.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    const parts = keys.map(k => JSON.stringify(k) + ':' + stableStringify((val as Record<string, unknown>)[k]));
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(val);
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  return stableStringify(arg);
}

// ── Generic family factory ─────────────────────────────────────

function createFamily<P, Arg>(factory: (arg: Arg, argKey: string) => P): ProviderFamily<P, Arg> {
  const cache = new Map<string, P>();

  const family = (arg: Arg): P => {
    const key = serializeArg(arg);
    let cached = cache.get(key);
    if (!cached) {
      cached = factory(arg, key);
      cache.set(key, cached);
    }
    return cached;
  };

  family.clear = () => cache.clear();

  return family;
}

// ── Standalone family factory functions ────────────────────────

/**
 * Create a parameterized read-only provider.
 *
 * ```ts
 * const userNameProvider = providerFamily<string, string>((ref, userId) => {
 *   const user = ref.watch(usersProvider)
 *   return user[userId]?.name ?? 'Unknown'
 * })
 * // Usage: useRiverWatch(userNameProvider('user-1'))
 * ```
 */
export function providerFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => T,
  options: ProviderOptions<T>,
): ProviderFamily<Provider<T>, Arg> {
  return createFamily((arg, key) =>
    provider((ref) => create(ref, arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}

/**
 * Create a parameterized mutable state provider.
 */
export function stateProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => T,
  options: ProviderOptions<T>,
): ProviderFamily<StateProvider<T>, Arg> {
  return createFamily((arg, key) =>
    stateProvider((ref) => create(ref, arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}

/**
 * Create a parameterized async data source provider.
 *
 * ```ts
 * const userProvider = promiseProviderFamily<User, string>((ref, userId) => {
 *   return fetchUser(userId)
 * })
 * // Usage: useRiverWatch(userProvider('user-123'))
 * ```
 */
export function promiseProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => Promise<T>,
  options: ProviderOptions<T>,
): ProviderFamily<PromiseProvider<T>, Arg> {
  return createFamily((arg, key) =>
    promiseProvider((ref) => create(ref, arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}

/**
 * Create a parameterized observable provider.
 */
export function observableProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => ObservableLike<T> | Promise<ObservableLike<T>>,
  options: ProviderOptions<T>,
): ProviderFamily<ObservableProvider<T>, Arg> {
  return createFamily((arg, key) =>
    observableProvider((ref) => create(ref, arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}

/**
 * Create a parameterized class-based notifier provider.
 */
export function notifierProviderFamily<N extends Notifier<any>, Arg>(
  createNotifier: (arg: Arg) => N,
  options: ProviderOptions<N extends Notifier<infer T> ? T : unknown>,
): ProviderFamily<NotifierProvider<N, N extends Notifier<infer T> ? T : unknown>, Arg> {
  return createFamily((arg, key) =>
    notifierProvider(() => createNotifier(arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}

/**
 * Create a parameterized class-based async notifier provider.
 */
export function asyncNotifierProviderFamily<N extends AsyncNotifier<any>, Arg>(
  createNotifier: (arg: Arg) => N,
  options: ProviderOptions<N extends AsyncNotifier<infer T> ? T : unknown>,
): ProviderFamily<AsyncNotifierProvider<N, N extends AsyncNotifier<infer T> ? T : unknown>, Arg> {
  return createFamily((arg, key) =>
    asyncNotifierProvider(() => createNotifier(arg), {
      ...options,
      name: `${options.name}(${key})`,
    }),
  );
}
