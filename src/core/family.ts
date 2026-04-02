/* ════════════════════════════════════════════════════════════════
 *  React River — Family Modifier
 *  Parameterized providers, analogous to Riverpod's .family.
 * ════════════════════════════════════════════════════════════════ */

import type { AsyncNotifier, Notifier } from "./notifier";
import {
  asyncNotifierProvider,
  futureProvider,
  notifierProvider,
  provider,
  stateProvider,
  streamProvider,
} from "./provider";
import type {
  AsyncNotifierProvider,
  FutureProvider,
  NotifierProvider,
  Provider,
  ProviderOptions,
  Ref,
  StateProvider,
  StreamProvider,
} from "./types";

// ── Family types ───────────────────────────────────────────────

export interface ProviderFamily<P, Arg> {
  (arg: Arg): P;
  /** Clear all cached provider instances */
  clear(): void;
}

// ── Key serialization ──────────────────────────────────────────

function serializeArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  return JSON.stringify(arg);
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
 * // Usage: useWatch(userNameProvider('user-1'))
 * ```
 */
export function providerFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => T,
  options: ProviderOptions = {},
): ProviderFamily<Provider<T>, Arg> {
  return createFamily((arg, key) =>
    provider((ref) => create(ref, arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}

/**
 * Create a parameterized mutable state provider.
 */
export function stateProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => T,
  options: ProviderOptions = {},
): ProviderFamily<StateProvider<T>, Arg> {
  return createFamily((arg, key) =>
    stateProvider((ref) => create(ref, arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}

/**
 * Create a parameterized async data source provider.
 *
 * ```ts
 * const userProvider = futureProviderFamily<User, string>((ref, userId) => {
 *   return fetchUser(userId)
 * })
 * // Usage: useWatch(userProvider('user-123'))
 * ```
 */
export function futureProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => Promise<T>,
  options: ProviderOptions = {},
): ProviderFamily<FutureProvider<T>, Arg> {
  return createFamily((arg, key) =>
    futureProvider((ref) => create(ref, arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}

/**
 * Create a parameterized stream provider.
 */
export function streamProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => AsyncIterable<T>,
  options: ProviderOptions = {},
): ProviderFamily<StreamProvider<T>, Arg> {
  return createFamily((arg, key) =>
    streamProvider((ref) => create(ref, arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}

/**
 * Create a parameterized class-based notifier provider.
 */
export function notifierProviderFamily<N extends Notifier<T>, T, Arg>(
  createNotifier: (arg: Arg) => N,
  options: ProviderOptions = {},
): ProviderFamily<NotifierProvider<N, T>, Arg> {
  return createFamily((arg, key) =>
    notifierProvider(() => createNotifier(arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}

/**
 * Create a parameterized class-based async notifier provider.
 */
export function asyncNotifierProviderFamily<N extends AsyncNotifier<T>, T, Arg>(
  createNotifier: (arg: Arg) => N,
  options: ProviderOptions = {},
): ProviderFamily<AsyncNotifierProvider<N, T>, Arg> {
  return createFamily((arg, key) =>
    asyncNotifierProvider(() => createNotifier(arg), {
      ...options,
      name: options.name ? `${options.name}(${key})` : undefined,
    }),
  );
}
