/* ════════════════════════════════════════════════════════════════
 *  React River — React Hooks
 *  useRiverWatch / useRiverRef / useRiverListen / useRiverMutation
 * ════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useRiverContainer } from './scope';

import type { AsyncValue } from '../core/async_value';
import { asyncData, asyncError, asyncLoading } from '../core/async_value';
import type { ListenerCallback, ProviderBase, RiverRef, StateProvider } from '../core/types';

// ── useRiverWatch — subscribe to a provider (triggers re-render) ────

/**
 * Subscribe to a provider's value. Re-renders the component when
 * the value changes. Analogous to `ref.watch()` in Riverpod.
 *
 * With optional selector for fine-grained subscriptions:
 * ```ts
 * const name = useRiverWatch(userProvider, (user) => user.name)
 * ```
 */
export function useRiverWatch<T>(provider: ProviderBase<T>): T;
export function useRiverWatch<T, S>(provider: ProviderBase<T>, selector: (value: T) => S): S;
export function useRiverWatch<T, S>(provider: ProviderBase<T>, selector?: (value: T) => S): T | S {
  const container = useRiverContainer();

  // Always keep the latest selector reference accessible inside getSnapshot.
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Cache keyed by both rawValue AND selector reference.
  //
  // Why rawValue is still needed:
  //   useSyncExternalStore calls getSnapshot after every commit as a tearing
  //   check. If the selector returns a new object each time (e.g. Array.filter),
  //   Object.is on selectedValue will always fail, causing React to force
  //   another render → infinite loop. Caching on rawValue breaks that cycle.
  //
  // Why we also key on selector (lastSelector):
  //   When the selector closes over external React state and that state changes,
  //   the selector reference changes on re-render. We detect that change and
  //   recompute even when rawValue hasn't changed, so external state is never
  //   stale in the result.
  type SelectorFn = (value: unknown) => unknown;
  const cacheRef = useRef<{
    rawValue: unknown;
    selectedValue: unknown;
    lastSelector: SelectorFn | undefined;
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
    const selAsOpaque = sel as unknown as SelectorFn;

    // Cache hit: rawValue unchanged AND it's the same selector reference
    // (same closure = same external state captured).
    if (cache && Object.is(cache.rawValue, rawValue) && cache.lastSelector === selAsOpaque) {
      return cache.selectedValue as S;
    }

    // Either rawValue changed or the selector is a new closure (external state
    // may have changed) — recompute.
    const selectedValue = sel(rawValue);

    // Preserve referential stability: if the new result is equal to the cached
    // one, return the old reference so React skips the re-render.
    if (cache && Object.is(cache.selectedValue, selectedValue)) {
      cacheRef.current = { rawValue, selectedValue: cache.selectedValue, lastSelector: selAsOpaque };
      return cache.selectedValue as S;
    }

    cacheRef.current = { rawValue, selectedValue, lastSelector: selAsOpaque };
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
      listen: (provider, callback) => containerRef.current.listen(provider, callback),
    };
  }

  return riverRefRef.current;
}

// ── useRiverListen — side-effect listener (no re-render) ────────────

/**
 * Listen to a provider's value changes and execute a callback.
 * Does NOT trigger re-renders. Analogous to `ref.listen()` in Riverpod.
 *
 * ```ts
 * useRiverListen(authProvider, (next, prev) => {
 *   if (next === null) navigate('/login')
 * })
 * ```
 */
export function useRiverListen<T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): void {
  const container = useRiverContainer();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return container.listen(provider, (next, prev) => {
      callbackRef.current(next as T, prev as T | undefined);
    });
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [container, provider.id]);
}

// ── useRiverMutation — imperative async operation (React-local state) ──

/**
 * Mutation function signature.
 * Receives a `RiverRef` for reading providers and the variables passed to `mutate()`.
 */
export type MutationFn<TData, TVariables> = (ref: RiverRef, variables: TVariables) => Promise<TData>;

/**
 * Options for `useRiverMutation`.
 *
 * `TContext` is the type returned by `onMutate`, which is then forwarded
 * to `onSuccess`, `onError`, and `onSettled` for optimistic update / rollback patterns.
 */
export interface UseRiverMutationOptions<TData, TVariables, TContext = unknown> {
  /**
   * Called **before** the mutation function fires.
   * Use this for optimistic updates — return a context value that will be
   * forwarded to `onSuccess`, `onError`, and `onSettled`.
   *
   * ```ts
   * onMutate: (variables, ref) => {
   *   const previous = ref.read(listProvider);
   *   ref.set(listProvider, optimisticUpdate(previous, variables));
   *   return { previous }; // context
   * }
   * ```
   */
  onMutate?: (variables: TVariables, ref: RiverRef) => TContext | Promise<TContext>;
  /** Called when the mutation succeeds. */
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined, ref: RiverRef) => void;
  /** Called when the mutation fails. */
  onError?: (error: unknown, variables: TVariables, context: TContext | undefined, ref: RiverRef) => void;
  /** Called when the mutation completes (success or error). */
  onSettled?: (data: TData | undefined, error: unknown | undefined, variables: TVariables, context: TContext | undefined, ref: RiverRef) => void;
}

/**
 * Return type of `useRiverMutation`.
 */
export interface UseRiverMutationResult<TData, TVariables> {
  /** Current mutation state as an AsyncValue. */
  state: AsyncValue<TData | undefined>;
  /** Trigger the mutation. */
  mutate: (variables: TVariables) => Promise<TData>;
  /** Reset state back to idle. */
  reset: () => void;
}

/**
 * Hook for imperative async operations with React-local state tracking.
 * Analogous to `useMutation` from TanStack Query, but integrated with River.
 *
 * The mutation function receives a `RiverRef` so it can read providers
 * without relying on closure capture — avoiding stale-closure issues.
 *
 * Each hook instance maintains its own isolated state, making it
 * perfect for per-item mutations in tables/lists.
 *
 * ```ts
 * // Basic usage
 * const { state, mutate } = useRiverMutation(async (ref, traderId: string) => {
 *   const service = ref.read(serviceProvider);
 *   await service.syncTrader(traderId);
 * });
 *
 * // With optimistic update & rollback
 * const { mutate } = useRiverMutation(
 *   async (ref, id: string) => {
 *     await ref.read(serviceProvider).deleteItem(id);
 *   },
 *   {
 *     onMutate: (id, ref) => {
 *       const previous = ref.read(listProvider);
 *       ref.set(listProvider, prev => prev.filter(item => item.id !== id));
 *       return { previous };
 *     },
 *     onError: (_err, _id, context, ref) => {
 *       if (context?.previous) ref.set(listProvider, context.previous);
 *     },
 *   },
 * );
 * ```
 */
export function useRiverMutation<TData = void, TVariables = void, TContext = unknown>(
  mutationFn: MutationFn<TData, TVariables>,
  options?: UseRiverMutationOptions<TData, TVariables, TContext>,
): UseRiverMutationResult<TData, TVariables> {
  const riverRef = useRiverRef();

  // Store latest fn & options in refs to avoid stale closures
  const fnRef = useRef(mutationFn);
  fnRef.current = mutationFn;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<AsyncValue<TData | undefined>>(
    () => asyncData<TData | undefined>(undefined),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      let context: TContext | undefined;
      const onMutateFn = optionsRef.current?.onMutate;
      if (onMutateFn) {
        try {
          // onMutate — before the mutation (optimistic updates go here)
          context = await onMutateFn(variables, riverRef);
        } catch {
          // If onMutate itself throws, still proceed with the mutation
        }
      }

      setState(asyncLoading(stateRef.current.data));
      try {
        const result = await fnRef.current(riverRef, variables);
        setState(asyncData<TData | undefined>(result));
        optionsRef.current?.onSuccess?.(result, variables, context, riverRef);
        optionsRef.current?.onSettled?.(result, undefined, variables, context, riverRef);
        return result;
      } catch (err) {
        setState(asyncError<TData | undefined>(err, stateRef.current.data));
        optionsRef.current?.onError?.(err, variables, context, riverRef);
        optionsRef.current?.onSettled?.(undefined, err, variables, context, riverRef);
        throw err;
      }
    },
    [riverRef],
  );

  const reset = useCallback(
    () => setState(asyncData<TData | undefined>(undefined)),
    [],
  );

  return { state, mutate, reset };
}
