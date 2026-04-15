/* ════════════════════════════════════════════════════════════════
 *  React River — RiverScope
 *  React context provider, analogous to Riverpod's ProviderScope.
 * ════════════════════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { RiverContainer } from '../core/container';

import type { RiverObserver } from '../core/observer';
import type { ProviderOverride } from '../core/types';

// ── Context ────────────────────────────────────────────────────

const RiverScopeContext = createContext<RiverContainer | null>(null);

/** @internal — used by hooks to access the container */
export function useRiverContainer(): RiverContainer {
  const container = useContext(RiverScopeContext);
  if (!container) {
    throw new Error(
      'useRiverWatch / useRiverRef / useRiverListen must be used within a <RiverScope>. ' +
        'Wrap your app root with <RiverScope> to provide a state container.',
    );
  }
  return container;
}

// ── RiverScope component ───────────────────────────────────────

export interface RiverScopeProps {
  children: ReactNode;
  /** Override specific providers (useful for testing or scoped state) */
  overrides?: ProviderOverride[];
  /** Global observers for provider lifecycle events */
  observers?: RiverObserver[];
}
/**
 * Root state container for React River.
 *
 * Analogous to Riverpod's `ProviderScope`. Place at the root of your app
 * (or nest for scoped overrides).
 *
 * ```tsx
 * <RiverScope>
 *   <App />
 * </RiverScope>
 * ```
 */
export function RiverScope({ children, overrides, observers }: RiverScopeProps) {
  const parentContainer = useContext(RiverScopeContext);

  const [container] = useState(
    () =>
      new RiverContainer({
        parent: parentContainer ?? undefined,
        overrides,
        observers,
      }),
  );

  // Dispose on actual unmount only, surviving Strict Mode double-invokes
  useEffect(() => {
    // Cancel pending disposal from previous unmount (StrictMode remount)
    const c = container as any;
    if (c._disposeTimeout) {
      clearTimeout(c._disposeTimeout);
      c._disposeTimeout = undefined;
    }
    return () => {
      // Defer disposal. If this is a StrictMode unmount, the subsequent
      // remount will cancel this timeout.
      c._disposeTimeout = setTimeout(() => {
        container.dispose();
      }, 0);
    };
  }, [container]);

  return <RiverScopeContext.Provider value={container}>{children}</RiverScopeContext.Provider>;
}
