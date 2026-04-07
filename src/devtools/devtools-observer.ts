/* ════════════════════════════════════════════════════════════════
 *  React River — DevTools Observer
 *  Passive observer that tracks provider events for DevTools.
 *  Does NOT register as a provider listener — zero lifecycle impact.
 * ════════════════════════════════════════════════════════════════ */

import type { RiverObserver } from '../core/observer';
import type { ProviderBase } from '../core/types';

// ── Event Types ────────────────────────────────────────────────

export interface DevToolsEvent {
  type: 'create' | 'update' | 'dispose' | 'error';
  providerName: string;
  providerKind: string;
  providerId: symbol;
  timestamp: number;
  value?: unknown;
  previousValue?: unknown;
  error?: unknown;
}

export interface DevToolsObserverHandle {
  /** The RiverObserver to pass into RiverScope/RiverContainer */
  observer: RiverObserver;
  /** Subscribe to devtools state changes (for useSyncExternalStore) */
  subscribe: (callback: () => void) => () => void;
  /** Version counter that increments on every event (for useSyncExternalStore) */
  getSnapshot: () => number;
  /** Get the event log (most recent first) */
  getEvents: () => readonly DevToolsEvent[];
  /** Clear the event log */
  clearEvents: () => void;
  /** Set the maximum number of events to keep */
  setMaxEvents: (max: number) => void;
}

// ── Factory ────────────────────────────────────────────────────

function getProviderLabel(provider: ProviderBase): string {
  return provider.name ?? provider.id.description ?? 'unknown';
}

/**
 * Create a DevTools observer handle.
 *
 * ```tsx
 * const devtools = createDevToolsObserver();
 *
 * <RiverScope observers={[devtools.observer]}>
 *   <App />
 *   <RiverDevTools devtools={devtools} />
 * </RiverScope>
 * ```
 *
 * @param maxEvents Maximum number of events to retain (default: 10)
 */
export function createDevToolsObserver(maxEvents = 100): DevToolsObserverHandle {
  let events: DevToolsEvent[] = [];
  let version = 0;
  let max = maxEvents;

  // DevTools' own subscriber set — completely separate from provider listeners
  const subscribers = new Set<() => void>();

  let notifyQueued = false;
  function notifySubscribers() {
    if (!notifyQueued) {
      notifyQueued = true;
      queueMicrotask(() => {
        notifyQueued = false;
        for (const cb of subscribers) cb();
      });
    }
  }

  function pushEvent(event: DevToolsEvent) {
    events = [event, ...events].slice(0, max);
    version++;
    notifySubscribers();
  }

  const observer: RiverObserver = {
    onProviderCreate(provider, value) {
      pushEvent({
        type: 'create',
        providerName: getProviderLabel(provider),
        providerKind: provider.kind,
        providerId: provider.id,
        timestamp: Date.now(),
        value,
      });
    },
    onProviderUpdate(provider, previousValue, newValue) {
      pushEvent({
        type: 'update',
        providerName: getProviderLabel(provider),
        providerKind: provider.kind,
        providerId: provider.id,
        timestamp: Date.now(),
        value: newValue,
        previousValue,
      });
    },
    onProviderDispose(provider) {
      pushEvent({
        type: 'dispose',
        providerName: getProviderLabel(provider),
        providerKind: provider.kind,
        providerId: provider.id,
        timestamp: Date.now(),
      });
    },
    onProviderError(provider, error) {
      pushEvent({
        type: 'error',
        providerName: getProviderLabel(provider),
        providerKind: provider.kind,
        providerId: provider.id,
        timestamp: Date.now(),
        error,
      });
    },
  };

  return {
    observer,
    subscribe: (callback: () => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    getSnapshot: () => version,
    getEvents: () => events,
    clearEvents: () => {
      events = [];
      version++;
      notifySubscribers();
    },
    setMaxEvents: (newMax: number) => {
      max = newMax;
      if (events.length > max) {
        events = events.slice(0, max);
        version++;
        notifySubscribers();
      }
    },
  };
}
