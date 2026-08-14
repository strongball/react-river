/* ════════════════════════════════════════════════════════════════
 *  React River — Container Internal Types
 *  Shared type definitions used by the container implementation.
 * ════════════════════════════════════════════════════════════════ */

import type { ProviderFamily } from './family';
import type { RiverObserver } from './observer';
import type { ListenerCallback, ProviderBase, ProviderOverride, Unsubscribe } from './types';

// ── Internal Provider State ────────────────────────────────────

export interface ProviderState {
  value: unknown;
  previousValue: unknown | undefined;
  version: number;

  /** useSyncExternalStore subscriptions — just () => void */
  snapshotListeners: Set<() => void>;
  /** Explicit value listeners — receives (prev, next) */
  valueListeners: Set<ListenerCallback<unknown>>;

  /** Stable IDs of providers this one depends on (via ref.watch). */
  dependencies: Set<string>;
  /** Providers that depend on this one */
  dependents: Set<string>;
  /** Selectors used by dependents. A value of null means unconditional dependency. */
  watchSelectors?: Map<string, Array<{ selector: (val: unknown) => unknown; lastValue: unknown }> | null>;

  /** Cleanup callbacks registered via ref.onDispose */
  disposeCallbacks: (() => void)[];
  /** Callbacks for when last listener removed */
  cancelCallbacks: (() => void)[];
  /** Callbacks for when listener added after cancel */
  resumeCallbacks: (() => void)[];

  /** Timeout for cacheTime before auto-dispose */
  disposeTimeout?: ReturnType<typeof setTimeout>;
  /** Generation counter for auto-dispose microtask cancellation. */
  disposeGeneration?: number;

  /** The notifier/controller instance (for notifier-based providers) */
  notifierInstance?: unknown;
  /** AbortController for async operations */
  abortController?: AbortController;

  /** Resolved auto-dispose flag (computed at init from provider option → scope cachePolicy → built-in default) */
  autoDispose: boolean;
  /** Resolved cache time in ms (computed at init from provider option → scope cachePolicy → built-in default) */
  cacheTime: number;

  initialized: boolean;
}

// ── DevTools Snapshot (read-only inspection) ───────────────────

export interface DevToolsProviderSnapshot {
  id: string;
  name: string;
  kind: string;
  value: unknown;
  previousValue: unknown | undefined;
  version: number;
  initialized: boolean;
  listenerCount: number;
  dependencyCount: number;
  dependentCount: number;
  dependencies: string[];
  dependents: string[];
  autoDispose: boolean;
  cacheTime: number | undefined;
}

// ── Cache Policy ───────────────────────────────────────────────

/**
 * Controls the default auto-dispose and cache-time behavior for
 * providers within a scope (container).
 *
 * Individual providers can still override these via their own `ProviderOptions`.
 *
 * Resolution order: provider option → scope cachePolicy → built-in defaults.
 */
export interface RiverCachePolicy {
  /**
   * Default `autoDispose` for providers that don't specify their own.
   * Built-in default is `true`.
   */
  autoDispose?: boolean;
  /**
   * Default `cacheTime` (ms) for providers that don't specify their own.
   * Only effective when the provider's resolved `autoDispose` is `true`.
   * Built-in default is `60000` (60 seconds).
   */
  cacheTime?: number;
}

// ── Container Options ──────────────────────────────────────────

export interface RiverContainerOptions {
  parent?: import('./container').RiverContainer;
  overrides?: ProviderOverride[];
  observers?: RiverObserver[];
  /** Default auto-dispose and cache-time policy for providers in this scope. */
  cachePolicy?: RiverCachePolicy;
  /**
   * Pre-computed state from server-side rendering (SSR).
   * Keys are provider `name` strings; values are the serialized state.
   *
   * For async providers (`promiseProvider`, `observableProvider`, `streamProvider`, `asyncNotifierProvider`),
   * the hydrated value is wrapped in `asyncData()` as the initial state instead of
   * `asyncLoading()`, avoiding a loading flash. The client-side factory still executes
   * and will update the value when fresh data arrives.
   *
   * Only providers with a `name` option can be hydrated.
   */
  initialState?: Record<string, unknown>;
}

// ── Container Callbacks (for extracted modules) ────────────────

/**
 * Lightweight interface exposing the container methods needed
 * by extracted initializer and ref-factory functions.
 * Avoids coupling those modules directly to the RiverContainer class.
 */
export interface ContainerCallbacks {
  updateValue(providerId: string, newValue: unknown): void;
  notifyObservers(
    event: 'create' | 'update' | 'dispose' | 'error',
    provider: ProviderBase<any>,
    ...args: unknown[]
  ): void;
  getState(id: string): ProviderState | undefined;
  ensureInitialized(provider: ProviderBase<any>): unknown;
  listen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe;
  read<T>(provider: ProviderBase<T>): T;
  invalidate(provider: ProviderBase<any>): void;
  invalidateFamily(family: ProviderFamily<any, any>): void;
  providerMap: Map<string, ProviderBase<any>>;
}

// ── Factory ────────────────────────────────────────────────────

export function createProviderState(): ProviderState {
  return {
    value: undefined,
    previousValue: undefined,
    version: 0,
    snapshotListeners: new Set(),
    valueListeners: new Set(),
    dependencies: new Set(),
    dependents: new Set(),
    disposeCallbacks: [],
    cancelCallbacks: [],
    resumeCallbacks: [],
    disposeTimeout: undefined,
    autoDispose: true,
    cacheTime: 0,
    initialized: false,
  };
}
