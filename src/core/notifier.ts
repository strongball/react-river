/* ════════════════════════════════════════════════════════════════
 *  React River — Notifier & AsyncNotifier Base Classes
 *  Class-based state management, analogous to Riverpod's Notifier.
 * ════════════════════════════════════════════════════════════════ */



import type { AsyncValue } from './async_value';
import type { Ref } from './types';

// ── Notifier (synchronous state) ───────────────────────────────

/**
 * Base class for synchronous notifiers.
 *
 * Subclass and override `build()` to provide the initial state.
 * Mutate state via the `state` setter — listeners are notified automatically.
 *
 * ```ts
 * class CounterNotifier extends Notifier<number> {
 *   build() { return 0 }
 *   increment() { this.state++ }
 * }
 * ```
 */
export abstract class Notifier<T> {
  /** @internal — injected by the container */
  _ref!: Ref;
  /** @internal */
  _state!: T;
  /** @internal */
  _setState!: (value: T) => void;

  /** Override to provide the initial state value. */
  abstract build(): T;

  /** Access the Ref for reading/watching other providers. */
  get ref(): Ref {
    return this._ref;
  }

  /** Current state value. */
  get state(): T {
    return this._state;
  }

  /** Update state — notifies all listeners. */
  set state(value: T) {
    this._setState(value);
  }

  /** Convenience: update state via a pure function. */
  update(updater: (current: T) => T): void {
    this.state = updater(this.state);
  }

  /**
   * Register a cleanup callback for when this provider is disposed.
   * @deprecated Use `this.ref.onDispose(callback)` directly for consistency.
   */
  onDispose(callback: () => void): void {
    this._ref.onDispose(callback);
  }
}

// ── AsyncNotifier (asynchronous state) ─────────────────────────

/**
 * Base class for asynchronous notifiers.
 *
 * Subclass and override `build()` to provide the initial async state.
 * The state is wrapped in `AsyncValue<T>` automatically.
 *
 * ```ts
 * class UserNotifier extends AsyncNotifier<User> {
 *   async build() {
 *     return await fetchUser(this.ref.read(userIdProvider))
 *   }
 *   async refresh() {
 *     this.state = asyncLoading(this.state.data)
 *     this.state = asyncData(await fetchUser(...))
 *   }
 * }
 * ```
 */
export abstract class AsyncNotifier<T> {
  /** @internal — injected by the container */
  _ref!: Ref;
  /** @internal */
  _state!: AsyncValue<T>;
  /** @internal */
  _setState!: (value: AsyncValue<T>) => void;

  /** Override to provide the initial async state. */
  abstract build(): Promise<T>;

  /** Access the Ref for reading/watching other providers. */
  get ref(): Ref {
    return this._ref;
  }

  /** Current async state. */
  get state(): AsyncValue<T> {
    return this._state;
  }

  /** Update async state — notifies all listeners. */
  set state(value: AsyncValue<T>) {
    this._setState(value);
  }

  /**
   * Register a cleanup callback for when this provider is disposed.
   * @deprecated Use `this.ref.onDispose(callback)` directly for consistency.
   */
  onDispose(callback: () => void): void {
    this._ref.onDispose(callback);
  }
}


