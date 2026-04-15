/* ════════════════════════════════════════════════════════════════
 *  React River — Consumer
 *  Render-prop alternative to hooks (for class components etc).
 * ════════════════════════════════════════════════════════════════ */

import { useReducer, useRef, useEffect, useMemo, type ReactNode } from 'react';

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

  // Standard cleanup on unmount
  useEffect(() => {
    const activeSubs = subs.current;
    return () => {
      // biome-ignore lint/nursery/noForEach: Map.forEach is concise here
      activeSubs.forEach((unsub) => unsub());
      activeSubs.clear();
    };
  }, []);

  const consumerRef = useMemo(() => ({
    ...riverRef,
    watch<T>(p: ProviderBase<T>): T {
      if (!subs.current.has(p.id)) {
        subs.current.set(p.id, riverRef.listen(p, forceUpdate));
      }
      return riverRef.read(p);
    },
  }), [riverRef]);

  return <>{children(consumerRef as ConsumerRef)}</>;
}
