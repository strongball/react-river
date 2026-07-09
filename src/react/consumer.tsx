/* ════════════════════════════════════════════════════════════════
 *  React River — Consumer
 *  Render-prop alternative to hooks (for class components etc).
 * ════════════════════════════════════════════════════════════════ */

import { useReducer, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';

import { useRiverRef } from './hooks';

import type { ProviderBase, RiverRef } from '../core/types';

// ── ConsumerRef — the ref object passed to render-prop ─────────

export interface ConsumerRef extends RiverRef {
  /** Subscribe to a provider (triggers re-render). */
  watch<T>(provider: ProviderBase<T>): T;
}

// ── Consumer component ─────────────────────────────────────────

export interface ConsumerProps {
  children: (ref: ConsumerRef) => ReactNode;
}

/**
 * Render-prop component for consuming providers without hooks.
 */
export function Consumer({ children }: ConsumerProps) {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const riverRef = useRiverRef();
  const subs = useRef(new Map<symbol, () => void>());
  // Track which providers were watched in the current render
  const watchedProvidersRef = useRef(new Map<symbol, ProviderBase<any>>());

  // Standard cleanup on unmount
  useEffect(() => {
    const activeSubs = subs.current;
    return () => {
      // biome-ignore lint/nursery/noForEach: Map.forEach is concise here
      activeSubs.forEach((unsub) => unsub());
      activeSubs.clear();
    };
  }, []);

  // After each render, sync subscriptions with the watched providers.
  // Using useLayoutEffect ensures it runs synchronously before painting
  // and avoids subscription side effects in the render phase.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const currentWatched = watchedProvidersRef.current;

    // 1. Clean up subscriptions for providers no longer in this render's watch set
    for (const [id, unsub] of subs.current) {
      if (!currentWatched.has(id)) {
        unsub();
        subs.current.delete(id);
      }
    }

    // 2. Subscribe to newly watched providers
    for (const [id, provider] of currentWatched) {
      if (!subs.current.has(id)) {
        subs.current.set(id, riverRef.listen(provider, forceUpdate));
      }
    }

    // 3. Clear the watched providers map for the next render
    currentWatched.clear();
  });

  const consumerRef = useMemo(() => ({
    ...riverRef,
    watch<T>(p: ProviderBase<T>): T {
      watchedProvidersRef.current.set(p.id, p);
      return riverRef.read(p);
    },
  }), [riverRef]);

  return <>{children(consumerRef as ConsumerRef)}</>;
}

