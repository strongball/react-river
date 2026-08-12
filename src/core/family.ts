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
  streamProvider,
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
  StreamProvider,
  StreamSource,
} from './types';

// ── Family types ───────────────────────────────────────────────

export interface ProviderFamily<P, Arg> {
  (arg: Arg): P;
  /** Clear all cached provider instances */
  clear(): void;
  /** Get all cached provider instances */
  getProviders(): P[];
}

// ── Key serialization ──────────────────────────────────────────

function propertyPath(path: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `Date(${Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString()})`;
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object') return value.constructor?.name || 'Object';
  if (typeof value === 'string') return `string ${JSON.stringify(value)}`;
  if (typeof value === 'number') return `number ${String(value)}`;
  if (typeof value === 'bigint') return `bigint ${String(value)}n`;
  if (typeof value === 'symbol') return `symbol ${String(value)}`;
  return typeof value;
}

function serializeArg(value: unknown, stack = new Map<object, string>(), path = 'argument'): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') {
    let json: string | undefined;
    try {
      json = JSON.stringify(value);
    } catch {
      throw new TypeError(
        `Family arguments must be JSON values or undefined. Invalid value at "${path}": received ${describeValue(value)}.`,
      );
    }
    if (json === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new TypeError(
        `Family arguments must be JSON values or undefined. Invalid value at "${path}": received ${describeValue(value)}.`,
      );
    }
    return json;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(`Family argument at "${path}" is an invalid Date.`);
    }
    // Keep Date distinct from an ISO string containing the same timestamp.
    return `Date(${JSON.stringify(value.toISOString())})`;
  }

  if (stack.has(value)) {
    throw new TypeError(
      `Family arguments cannot contain circular references: "${path}" references "${stack.get(value)}".`,
    );
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(
      `Family arguments must be plain objects or arrays. Invalid value at "${path}": received ${describeValue(value)}.`,
    );
  }

  stack.set(value, path);
  const json = Array.isArray(value)
    ? `[${value.map((item, index) => serializeArg(item, stack, `${path}[${index}]`)).join(',')}]`
    : `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${serializeArg((value as Record<string, unknown>)[key], stack, propertyPath(path, key))}`,
        )
        .join(',')}}`;
  stack.delete(value);
  return json;
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
  family.getProviders = () => Array.from(cache.values());

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
 * Create a parameterized generator / iterable data source provider.
 */
export function streamProviderFamily<T, Arg>(
  create: (ref: Ref, arg: Arg) => StreamSource<T> | PromiseLike<StreamSource<T>>,
  options: ProviderOptions<T>,
): ProviderFamily<StreamProvider<T>, Arg> {
  return createFamily((arg, key) =>
    streamProvider((ref) => create(ref, arg), {
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
