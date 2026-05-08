/* ════════════════════════════════════════════════════════════════
 *  React River — Core Type Definitions
 * ════════════════════════════════════════════════════════════════ */

import type { AsyncValue } from './async_value';

// ── Utility Types ──────────────────────────────────────────────

export type Unsubscribe = () => void;
export type ListenerCallback<T> = (next: T, previous: T | undefined) => void;

// ── Provider Kind ──────────────────────────────────────────────

export type ProviderKind =
  | 'provider'
  | 'stateProvider'
  | 'promiseProvider'
  | 'observableProvider'
  | 'notifierProvider'
  | 'asyncNotifierProvider'
  | 'notifierAccessor'
  | 'promiseAccessor';

// ── Provider Options ───────────────────────────────────────────

export interface ProviderOptions<T = any> {
  /** Unique name for debugging, DevTools, and SSR hydration. */
  name: string;
  /**
   * If true, provider is disposed when all listeners are removed.
   * Default is true.
   */
  autoDispose?: boolean;
  /**
   * Additional time in milliseconds to keep the provider alive after all listeners are removed.
   * Only has an effect if `autoDispose` is true.
   * Default is 0ms (dispose immediately).
   */
  cacheTime?: number;
  /**
   * If true, the provider will use the topmost (root) container's state,
   * sharing a single instance across all scopes.
   * If false (default), each scope creates its own isolated instance.
   */
  global?: boolean;
  /**
   * Whether this provider participates in SSR dehydration/hydration.
   * - `true` (default): State is exported by `dehydrate()` and can be hydrated from `initialState`.
   * - `false`: State is excluded from SSR entirely.
   */
  ssr?: boolean;
  /**
   * Custom serialization function for SSR dehydration.
   * Transforms the provider's state value into a JSON-safe representation.
   * When provided, the serializability check is skipped (you are responsible for producing safe output).
   *
   * @example
   * ```ts
   * toJSON: (user: User) => ({ id: user.id, name: user.name })
   * ```
   */
  toJSON?: (value: T) => unknown;
  /**
   * Custom deserialization function for SSR hydration.
   * Transforms the serialized JSON representation back into the provider's state type.
   * Called on the client side when hydrating from `initialState`.
   *
   * @example
   * ```ts
   * fromJSON: (json) => new User(json.id, json.name)
   * ```
   */
  fromJSON?: (json: unknown) => T;
}

// ── Ref (used inside provider create functions) ────────────────

export interface Ref {
  /** Subscribe to another provider. Establishes a dependency. */
  watch<T>(provider: ProviderBase<T>): T;
  /** Subscribe to a PromiseAccessor and select from the resolved data. Selector receives `T`, returns `Promise<R>`. */
  watch<T, R>(provider: PromiseAccessor<T>, select: (value: T | undefined) => R): Promise<R>;
  /** Subscribe to a provider and select a specific value to trigger updates only when the selection changes. */
  watch<T, R>(provider: ProviderBase<T>, select: (value: T) => R): R;
  /** Read another provider's current value once (no subscription). */
  read<T>(provider: ProviderBase<T>): T;
  /** Listen to another provider's changes with a callback. */
  listen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe;
  /** Register a callback invoked when this provider is disposed. */
  onDispose(callback: () => void): void;
  /** Register a callback invoked when the last listener is removed. */
  onCancel(callback: () => void): void;
  /** Register a callback invoked when a new listener is added after cancel. */
  onResume(callback: () => void): void;
  /** Force this provider to re-initialize. */
  invalidateSelf(): void;
}

// ── RiverRef (used in React components via useRiverRef) ────────

export interface RiverRef {
  /** Read a provider's current value once. */
  read<T>(provider: ProviderBase<T>): T;
  /** Force a provider to re-initialize. */
  invalidate(provider: ProviderBase<any>): void;
  /** Invalidate and immediately return the new value. */
  refresh<T>(provider: ProviderBase<T>): T;
  /** Set a StateProvider's value directly. */
  set<T>(provider: StateProvider<T>, value: T | ((prev: T) => T)): void;
  /** Listen to a provider's changes with a callback. */
  listen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe;
}

// ── Provider Base ──────────────────────────────────────────────

export interface ProviderBase<T = any> {
  readonly id: symbol;
  readonly kind: ProviderKind;
  readonly name: string | undefined;
  readonly options: ProviderOptions<T>;
  readonly __phantom?: T;
}

/** Get a human-readable label for a provider (for DevTools / debugging). */
export function getProviderLabel(provider: ProviderBase<any>): string {
  return provider.name ?? provider.id.description ?? 'unknown';
}

// ── Observable Support ──────────────────────────────────────────

export interface ObservableLike<T> {
  subscribe(
    callbacks:
      | {
          next: (value: T) => void;
          error: (error: unknown) => void;
          complete: () => void;
        }
      | ((value: T) => void),
  ): { unsubscribe: () => void };
}

// ── Concrete Provider Types ────────────────────────────────────

/** Read-only computed provider */
export interface Provider<T> extends ProviderBase<T> {
  readonly kind: 'provider';
  /** @internal */
  readonly _create: (ref: Ref) => T;
}

/** Simple mutable state provider */
export interface StateProvider<T> extends ProviderBase<T> {
  readonly kind: 'stateProvider';
  /** @internal */
  readonly _create: (ref: Ref) => T;
  /** Sub-provider exposing the StateController instance */
  readonly notifier: NotifierAccessor<StateController<T>>;
}

/** Async data source provider (Promise-based) */
export interface PromiseProvider<T> extends ProviderBase<AsyncValue<T>> {
  readonly kind: 'promiseProvider';
  /** @internal */
  readonly _create: (ref: Ref) => Promise<T>;
  /** Sub-provider exposing a Promise that resolves when the provider has data */
  readonly promise: PromiseAccessor<T>;
}

/** Observable data source provider (Observable-based) */
export interface ObservableProvider<T> extends ProviderBase<AsyncValue<T>> {
  readonly kind: 'observableProvider';
  /** @internal */
  readonly _create: (ref: Ref) => ObservableLike<T> | Promise<ObservableLike<T>>;
  /** Sub-provider exposing a Promise that resolves when the provider has data */
  readonly promise: PromiseAccessor<T>;
}

/** Class-based synchronous state provider */
export interface NotifierProvider<N, T> extends ProviderBase<T> {
  readonly kind: 'notifierProvider';
  /** @internal */
  readonly _createNotifier: () => N;
  /** Sub-provider exposing the Notifier instance */
  readonly notifier: NotifierAccessor<N>;
}

/** Class-based asynchronous state provider */
export interface AsyncNotifierProvider<N, T> extends ProviderBase<AsyncValue<T>> {
  readonly kind: 'asyncNotifierProvider';
  /** @internal */
  readonly _createNotifier: () => N;
  /** Sub-provider exposing the AsyncNotifier instance */
  readonly notifier: NotifierAccessor<N>;
  /** Sub-provider exposing a Promise that resolves when the provider has data */
  readonly promise: PromiseAccessor<T>;
}

/** Sub-provider that yields the notifier/controller of its parent */
export interface NotifierAccessor<N> extends ProviderBase<N> {
  readonly kind: 'notifierAccessor';
  /** @internal */
  readonly _parentId: symbol;
  /** @internal */
  readonly _parentProvider?: ProviderBase<any>;
}

/** Sub-provider that yields a Promise resolving to the current/next data value */
export interface PromiseAccessor<T> extends ProviderBase<Promise<T>> {
  readonly kind: 'promiseAccessor';
  /** @internal */
  readonly _parentId: symbol;
  /** @internal */
  readonly _parentProvider: ProviderBase<AsyncValue<T>>;
}

// ── StateController ────────────────────────────────────────────

export interface StateController<T> {
  get state(): T;
  set state(value: T);
  update(updater: (current: T) => T): void;
}

// ── Provider Override (for testing / scoping) ──────────────────

export interface ProviderOverride<T = any> {
  readonly original: ProviderBase<T>;
  readonly create: (ref: Ref) => T;
}

// ── Union type for any provider ────────────────────────────────

// biome-ignore lint: we need `any` for the union type
export type AnyProvider<T = any> =
  | Provider<T>
  | StateProvider<T>
  | PromiseProvider<T>
  | ObservableProvider<T>
  | NotifierProvider<unknown, T>
  | AsyncNotifierProvider<unknown, T>
  | NotifierAccessor<T>
  | PromiseAccessor<T>;
