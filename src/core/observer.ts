/* ════════════════════════════════════════════════════════════════
 *  React River — RiverObserver
 *  Global observer for provider lifecycle events.
 * ════════════════════════════════════════════════════════════════ */

import type { ProviderBase } from './types';

/**
 * Observer interface for monitoring provider lifecycle events.
 * Analogous to Riverpod's ProviderObserver.
 *
 * Register observers via `RiverScope` or `RiverContainer`.
 */
export interface RiverObserver {
  /** Called when a provider is first initialized */
  onProviderCreate?(provider: ProviderBase, value: unknown): void;

  /** Called when a provider's value changes */
  onProviderUpdate?(provider: ProviderBase, previousValue: unknown, newValue: unknown): void;

  /** Called when a provider is disposed */
  onProviderDispose?(provider: ProviderBase): void;

  /** Called when a provider encounters an error during initialization */
  onProviderError?(provider: ProviderBase, error: unknown): void;
}
