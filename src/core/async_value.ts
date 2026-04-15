/* ════════════════════════════════════════════════════════════════
 *  React River — AsyncValue<T>
 *  Three-state wrapper for asynchronous operations.
 * ════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────

export type AsyncValue<T> = AsyncLoading<T> | AsyncData<T> | AsyncError<T>;

export interface AsyncLoading<T> {
  readonly status: 'loading';
  /** Previous data, if available (e.g. during refresh) */
  readonly data: T | undefined;
  readonly error: undefined;
  readonly isLoading: true;
  readonly isError: false;
  readonly hasData: boolean;
}

export interface AsyncData<T> {
  readonly status: 'data';
  readonly data: T;
  readonly error: undefined;
  readonly isLoading: false;
  readonly isError: false;
  readonly hasData: true;
}

export interface AsyncError<T> {
  readonly status: 'error';
  /** Previous data, if available */
  readonly data: T | undefined;
  readonly error: unknown;
  readonly isLoading: false;
  readonly isError: true;
  readonly hasData: boolean;
}

// ── Constructors ───────────────────────────────────────────────

export function asyncLoading<T>(previousData?: T): AsyncValue<T> {
  return {
    status: 'loading',
    data: previousData,
    error: undefined,
    isLoading: true,
    isError: false,
    hasData: previousData !== undefined,
  };
}

export function asyncData<T>(data: T): AsyncValue<T> {
  return {
    status: 'data',
    data,
    error: undefined,
    isLoading: false,
    isError: false,
    hasData: true,
  };
}

export function asyncError<T>(error: unknown, previousData?: T): AsyncValue<T> {
  return {
    status: 'error',
    data: previousData,
    error,
    isLoading: false,
    isError: true,
    hasData: previousData !== undefined,
  };
}

// ── Pattern Matching ───────────────────────────────────────────

export interface AsyncValueMatchers<T, R> {
  data: (data: T) => R;
  loading: () => R;
  error: (error: unknown) => R;
}

/** Exhaustive pattern matching on AsyncValue — like Riverpod's .when() */
export function when<T, R>(value: AsyncValue<T>, matchers: AsyncValueMatchers<T, R>): R {
  switch (value.status) {
    case 'data':
      return matchers.data(value.data);
    case 'loading':
      return matchers.loading();
    case 'error':
      return matchers.error(value.error);
  }
}

/** Partial pattern matching — returns undefined for unhandled states */
export function whenOrNull<T, R>(value: AsyncValue<T>, matchers: Partial<AsyncValueMatchers<T, R>>): R | undefined {
  switch (value.status) {
    case 'data':
      return matchers.data?.(value.data);
    case 'loading':
      return matchers.loading?.();
    case 'error':
      return matchers.error?.(value.error);
  }
}

// ── Transformers ───────────────────────────────────────────────

/** Map the data inside an AsyncValue, preserving the status */
export function mapAsyncValue<T, U>(value: AsyncValue<T>, fn: (data: T) => U): AsyncValue<U> {
  switch (value.status) {
    case 'data':
      return asyncData(fn(value.data));
    case 'loading':
      return asyncLoading(value.data !== undefined ? fn(value.data) : undefined);
    case 'error':
      return asyncError(value.error, value.data !== undefined ? fn(value.data) : undefined);
  }
}

/** Extract data or throw if not in data state */
export function requireData<T>(value: AsyncValue<T>): T {
  if (value.status === 'data') return value.data;
  if (value.hasData && value.data !== undefined) return value.data;
  throw new Error(
    `AsyncValue has no data. Current status: ${value.status}` + (value.status === 'error' ? ` — ${value.error}` : ''),
  );
}

/** Check if two AsyncValues are equal (by reference for data) */
export function asyncValueEquals<T>(a: AsyncValue<T>, b: AsyncValue<T>): boolean {
  if (a.status !== b.status) return false;
  if (!Object.is(a.data, b.data)) return false;
  if (!Object.is(a.error, b.error)) return false;
  return true;
}

/**
 * Convert an AsyncValue to a Promise.
 *
 * - `data`    → `Promise.resolve(extractData(av))`
 * - `error`   → `Promise.reject(av.error)`
 * - `loading` → Subscribes via `listenForResolution` and resolves/rejects when settled.
 *
 * @param av          The current async value
 * @param extractData Extract the data payload (defaults to `av.data`)
 * @param listenForResolution Subscribe to future state changes (required when `av.status === 'loading'`)
 */
export function asyncValueToPromise<T>(
  av: AsyncValue<T>,
  extractData: (av: AsyncValue<T>) => unknown = (v) => (v as AsyncData<T>).data,
  listenForResolution?: (onNext: (next: AsyncValue<T>) => void) => () => void,
): Promise<unknown> {
  if (av.status === 'data') {
    return Promise.resolve(extractData(av));
  }
  if (av.status === 'error') {
    return Promise.reject(av.error);
  }

  // loading — subscribe and wait
  return new Promise((resolve, reject) => {
    const unsubscribe = listenForResolution?.((next) => {
      if (next.status === 'data') {
        unsubscribe?.();
        resolve(extractData(next));
      } else if (next.status === 'error') {
        unsubscribe?.();
        reject(next.error);
      }
    });
  });
}
