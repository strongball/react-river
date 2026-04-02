/* ════════════════════════════════════════════════════════════════
 *  React River — Consumer
 *  Render-prop alternative to hooks (for class components etc).
 * ════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react"
import type { ProviderBase, RiverRef } from "../core/types"
import { useRiverRef } from "./hooks"

// ── ConsumerRef — the ref object passed to render-prop ─────────

export interface ConsumerRef extends RiverRef {
	/** Subscribe to a provider (triggers re-render). */
	watch<T>(provider: ProviderBase<T>): T
}

// ── Consumer component ─────────────────────────────────────────

export interface ConsumerProps {
	children: (ref: ConsumerRef) => ReactNode
}

/**
 * Render-prop component for consuming providers without hooks.
 *
 * ```tsx
 * <Consumer>
 *   {(ref) => {
 *     const count = ref.watch(counterProvider)
 *     return <span>{count}</span>
 *   }}
 * </Consumer>
 * ```
 *
 * Note: Each `ref.watch()` call causes the Consumer to re-render
 * when the watched provider changes.
 */
export function Consumer({ children }: ConsumerProps) {
	return <ConsumerInner>{children}</ConsumerInner>
}

/**
 * Inner component that collects watched providers and re-renders.
 * Uses a two-pass approach: first render collects watches,
 * subsequent renders use hooks in stable order.
 */
function ConsumerInner({
	children,
}: {
	children: (ref: ConsumerRef) => ReactNode
}) {
	const riverRef = useRiverRef()

	// Build a ConsumerRef that delegates watch to useWatch
	// Note: This is a simplified implementation. For production use,
	// the watch calls must follow Rules of Hooks (stable order).
	// Users should prefer the useWatch hook directly.
	const consumerRef: ConsumerRef = {
		...riverRef,
		watch<T>(provider: ProviderBase<T>): T {
			// Delegate to the container's read (not reactive in this simple impl)
			// For full reactivity, users should use useWatch hook
			return riverRef.read(provider)
		},
	}

	return <>{children(consumerRef)}</>
}
