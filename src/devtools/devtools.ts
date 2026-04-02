/* ════════════════════════════════════════════════════════════════
 *  React River — DevTools Observer
 *  Console-based observer for debugging provider lifecycle.
 * ════════════════════════════════════════════════════════════════ */

import type { RiverObserver } from "../core/observer"
import type { ProviderBase } from "../core/types"

function getProviderLabel(provider: ProviderBase): string {
	return provider.name ?? provider.id.description ?? "unknown"
}

/**
 * A simple console-based observer for debugging.
 *
 * ```tsx
 * <RiverScope observers={[loggerObserver()]}>
 *   <App />
 * </RiverScope>
 * ```
 */
export function loggerObserver(prefix = "🌊 River"): RiverObserver {
	return {
		onProviderCreate(provider, value) {
			console.log(
				`${prefix} [CREATE] ${getProviderLabel(provider)}`,
				value,
			)
		},
		onProviderUpdate(provider, previousValue, newValue) {
			console.log(
				`${prefix} [UPDATE] ${getProviderLabel(provider)}`,
				{ from: previousValue, to: newValue },
			)
		},
		onProviderDispose(provider) {
			console.log(
				`${prefix} [DISPOSE] ${getProviderLabel(provider)}`,
			)
		},
		onProviderError(provider, error) {
			console.error(
				`${prefix} [ERROR] ${getProviderLabel(provider)}`,
				error,
			)
		},
	}
}
