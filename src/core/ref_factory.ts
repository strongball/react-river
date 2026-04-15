/* ════════════════════════════════════════════════════════════════
 *  React River — Ref Factory
 *  Creates the Ref object used inside provider create functions,
 *  and handles watch/dependency-tracking logic.
 * ════════════════════════════════════════════════════════════════ */

import { asyncValueToPromise } from './async_value';
import type { AsyncValue } from './async_value';
import type { ContainerCallbacks } from './container_types';
import type { ListenerCallback, PromiseAccessor, ProviderBase, Ref, Unsubscribe } from './types';

// ── Return type for watch helpers ──────────────────────────────

interface WatchResult {
  trackTarget: ProviderBase;
  effectiveSelector: ((val: unknown) => unknown) | undefined;
  selectedValue: unknown;
  returnValue: unknown;
}

// ── Ref Factory ────────────────────────────────────────────────

export function createRef(cb: ContainerCallbacks, ownerId: symbol): Ref {
  return {
    watch: <T, R = T>(provider: ProviderBase<T>, select?: (value: T) => R): R => {
      let result: WatchResult;

      if (provider.kind === 'promiseAccessor') {
        result = watchPromiseAccessor(
          cb,
          provider as unknown as PromiseAccessor<unknown>,
          select as ((value: unknown) => unknown) | undefined,
        );
      } else {
        result = watchRegularProvider(cb, provider, select as ((value: unknown) => unknown) | undefined);
      }

      trackDependency(cb, ownerId, result.trackTarget, result.effectiveSelector, result.selectedValue);
      return result.returnValue as R;
    },

    read: <T>(provider: ProviderBase<T>): T => {
      return cb.ensureInitialized(provider) as T;
    },

    listen: <T>(provider: ProviderBase<T>, callback: ListenerCallback<T>): Unsubscribe => {
      return cb.listen(provider, callback);
    },

    onDispose: (callback: () => void): void => {
      cb.getState(ownerId)?.disposeCallbacks.push(callback);
    },

    onCancel: (callback: () => void): void => {
      cb.getState(ownerId)?.cancelCallbacks.push(callback);
    },

    onResume: (callback: () => void): void => {
      cb.getState(ownerId)?.resumeCallbacks.push(callback);
    },

    invalidateSelf: (): void => {
      const provider = cb.providerMap.get(ownerId);
      if (provider) cb.invalidate(provider);
    },
  };
}

// ── Watch: PromiseAccessor ─────────────────────────────────────

/**
 * Handle ref.watch for promiseAccessor providers.
 * The promiseAccessor is transparent in the dependency graph —
 * dependency is always tracked on the parent provider (which holds AsyncValue<T>).
 */
function watchPromiseAccessor(
  cb: ContainerCallbacks,
  accessor: PromiseAccessor<unknown>,
  select?: (value: unknown) => unknown,
): WatchResult {
  const parentProvider = accessor._parentProvider;
  cb.ensureInitialized(parentProvider);

  const parentValue = cb.read(parentProvider) as AsyncValue<unknown>;
  const trackTarget = parentProvider;

  if (select) {
    const data = parentValue.status === 'data' ? parentValue.data : undefined;
    const selectedValue = select(data);
    // Wrap selector to extract data from AsyncValue for comparison
    const effectiveSelector = (val: unknown) => {
      const av = val as AsyncValue<unknown>;
      return av.status === 'data' ? select(av.data) : undefined;
    };
    const extractSelected = (av: AsyncValue<unknown>) => select((av as { data: unknown }).data);
    const returnValue = asyncValueToPromise(
      parentValue,
      extractSelected,
      (onNext) => cb.listen(parentProvider, (next) => onNext(next as AsyncValue<unknown>)),
    );
    return { trackTarget, effectiveSelector, selectedValue, returnValue };
  }

  // No selector — return the raw Promise from the promiseAccessor
  return {
    trackTarget,
    effectiveSelector: undefined,
    selectedValue: undefined,
    returnValue: cb.read(accessor as unknown as ProviderBase),
  };
}

// ── Watch: Regular Provider ────────────────────────────────────

/** Handle ref.watch for regular (non-promiseAccessor) providers. */
function watchRegularProvider(
  cb: ContainerCallbacks,
  provider: ProviderBase,
  select?: (value: unknown) => unknown,
): WatchResult {
  const rawValue = cb.ensureInitialized(provider);
  const selectedValue = select ? select(rawValue) : rawValue;
  return {
    trackTarget: provider,
    effectiveSelector: select ?? undefined,
    selectedValue,
    returnValue: selectedValue,
  };
}

// ── Dependency Tracking ────────────────────────────────────────

/** Record a dependency relationship between owner and target providers. */
function trackDependency(
  cb: ContainerCallbacks,
  ownerId: symbol,
  trackTarget: ProviderBase,
  effectiveSelector: ((val: unknown) => unknown) | undefined,
  selectedValue: unknown,
): void {
  const ownerState = cb.getState(ownerId);
  if (ownerState) {
    ownerState.dependencies.add(trackTarget);
  }
  const targetState = cb.getState(trackTarget.id);
  if (targetState) {
    targetState.dependents.add(ownerId);

    if (effectiveSelector) {
      if (!targetState.watchSelectors) targetState.watchSelectors = new Map();
      let selectors = targetState.watchSelectors.get(ownerId);
      // If it's already null, it means there's an unconditional watch somewhere,
      // so we don't need to track selective watches anymore.
      if (selectors !== null) {
        if (!selectors) {
          selectors = [];
          targetState.watchSelectors.set(ownerId, selectors);
        }
        selectors.push({ selector: effectiveSelector, lastValue: selectedValue });
      }
    } else {
      // Unconditional watch
      if (!targetState.watchSelectors) targetState.watchSelectors = new Map();
      targetState.watchSelectors.set(ownerId, null);
    }
  }
}
