/* ════════════════════════════════════════════════════════════════
 *  React River — React Hooks
 *  useWatch / useRiverRef / useListen
 * ════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { useRiverContainer } from './scope';

import type { ListenerCallback, ProviderBase, RiverRef, StateProvider } from '../core/types';

// ── useWatch — subscribe to a provider (triggers re-render) ────

/**
 * Subscribe to a provider's value. Re-renders the component when
 * the value changes. Analogous to `ref.watch()` in Riverpod.
 *
 * With optional selector for fine-grained subscriptions:
 * ```ts
 * const name = useWatch(userProvider, (user) => user.name)
 * ```
 */
export function useWatch<T>(provider: ProviderBase<T>): T;
export function useWatch<T, S>(provider: ProviderBase<T>, selector: (value: T) => S): S;
export function useWatch<T, S>(provider: ProviderBase<T>, selector?: (value: T) => S): T | S {
  const container = useRiverContainer();

  // Keep selector ref stable for getSnapshot closure
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Cache for selector mode — prevents unnecessary re-renders
  const cacheRef = useRef<{
    rawValue: unknown;
    selectedValue: unknown;
  } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return container.subscribe(provider, onStoreChange);
    },
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [container, provider.id],
  );

  const getSnapshot = useCallback((): T | S => {
    const rawValue = container.read(provider) as T;
    const sel = selectorRef.current;

    if (!sel) return rawValue;

    const cache = cacheRef.current;

    // If raw value hasn't changed, return cached selected value
    if (cache && Object.is(cache.rawValue, rawValue)) {
      return cache.selectedValue as S;
    }

    const selectedValue = sel(rawValue);

    // If selected value hasn't changed, return cached reference
    if (cache && Object.is(cache.selectedValue, selectedValue)) {
      cacheRef.current = { rawValue, selectedValue: cache.selectedValue };
      return cache.selectedValue as S;
    }

    cacheRef.current = { rawValue, selectedValue };
    return selectedValue;
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [container, provider.id]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ── useRiverRef — imperative access to the container ───────────

/**
 * Returns a `RiverRef` for imperative operations.
 * Analogous to using `ref.read()` in Riverpod callbacks.
 *
 * ```ts
 * const ref = useRiverRef()
 * const handleClick = () => {
 *   ref.read(counterProvider)
 *   ref.invalidate(dataProvider)
 *   ref.set(nameProvider, 'new name')
 * }
 * ```
 */
export function useRiverRef(): RiverRef {
  const container = useRiverContainer();

  // Track latest container so stable ref methods always use the right one
  const containerRef = useRef(container);
  containerRef.current = container;

  // Return a stable ref object that delegates to the container
  const riverRefRef = useRef<RiverRef | null>(null);

  if (!riverRefRef.current) {
    riverRefRef.current = {
      read: (provider) => containerRef.current.read(provider),
      invalidate: (provider) => containerRef.current.invalidate(provider),
      refresh: (provider) => containerRef.current.refresh(provider),
      set: <T>(provider: StateProvider<T>, value: T | ((prev: T) => T)) => containerRef.current.set(provider, value),
    };
  }

  return riverRefRef.current;
}

// ── useListen — side-effect listener (no re-render) ────────────

/**
 * Listen to a provider's value changes and execute a callback.
 * Does NOT trigger re-renders. Analogous to `ref.listen()` in Riverpod.
 *
 * ```ts
 * useListen(authProvider, (prev, next) => {
 *   if (next === null) navigate('/login')
 * })
 * ```
 */
export function useListen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): void {
  const container = useRiverContainer();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return container.listen(provider, (prev, next) => {
      callbackRef.current(prev as T | undefined, next as T);
    });
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [container, provider.id]);
}
