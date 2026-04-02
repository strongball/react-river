/* ════════════════════════════════════════════════════════════════
 *  React River — RiverScope
 *  React context provider, analogous to Riverpod's ProviderScope.
 * ════════════════════════════════════════════════════════════════ */

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	type ReactNode,
} from "react"
import { RiverContainer } from "../core/container"
import type { RiverObserver } from "../core/observer"
import type { ProviderOverride } from "../core/types"

// ── Context ────────────────────────────────────────────────────

const RiverScopeContext = createContext<RiverContainer | null>(null)

/** @internal — used by hooks to access the container */
export function useRiverContainer(): RiverContainer {
	const container = useContext(RiverScopeContext)
	if (!container) {
		throw new Error(
			"useWatch / useRiverRef / useListen must be used within a <RiverScope>. " +
				"Wrap your app root with <RiverScope> to provide a state container.",
		)
	}
	return container
}

// ── RiverScope component ───────────────────────────────────────

export interface RiverScopeProps {
	children: ReactNode
	/** Override specific providers (useful for testing or scoped state) */
	overrides?: ProviderOverride[]
	/** Global observers for provider lifecycle events */
	observers?: RiverObserver[]
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
export function RiverScope({
	children,
	overrides,
	observers,
}: RiverScopeProps) {
	const parentContainer = useContext(RiverScopeContext)

	const container = useMemo(
		() =>
			new RiverContainer({
				parent: parentContainer ?? undefined,
				overrides,
				observers,
			}),
		// Container identity should remain stable for the scope's lifetime.
		// Overrides & observers are only read on mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[parentContainer],
	)

	// Dispose container on unmount
	useEffect(() => {
		return () => container.dispose()
	}, [container])

	return (
		<RiverScopeContext.Provider value={container}>
			{children}
		</RiverScopeContext.Provider>
	)
}
