/* ════════════════════════════════════════════════════════════════
 *  React River — DevTools Floating Panel
 *  A draggable, collapsible panel showing all provider states.
 *
 *  ⚠ Uses RiverObserver for change detection — does NOT subscribe
 *  or listen to providers, so auto-dispose is never affected.
 * ════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useRiverContainer } from '../react/scope';
// Components
import { DependencyGraph } from './components/DependencyGraph';
import { EventItem } from './components/EventItem';
import { IconTrash } from './components/Icons';
import { ProviderItem } from './components/ProviderItem';
// Hooks
import { useDraggable } from './hooks/useDraggable';
import { injectDevToolsStyles } from './inject-styles';

// Types
import type { DevToolsObserverHandle } from './devtools-observer';

// Inject styles at module load time
injectDevToolsStyles();

export interface RiverDevToolsProps {
  devtools: DevToolsObserverHandle;
  /** Default position of the panel */
  defaultPosition?: { x: number; y: number };
  /** Default open state */
  defaultOpen?: boolean;
}

type Tab = 'providers' | 'events' | 'graph';

/**
 * Main DevTools Component
 * Orchestrates the floating panel, tabs, and data synchronization.
 */
export function RiverDevTools({ devtools, defaultPosition, defaultOpen = false }: RiverDevToolsProps) {
  const container = useRiverContainer();

  // ── Pin devtools on first render ───────────────────────────
  // Fixes the case where createDevToolsObserver() is called inside
  // the render function — ensures we always read from the same instance
  // that was registered in RiverScope observers[].
  const pinnedDevtools = useRef(devtools);

  // Stable subscribe/getSnapshot — never recreated, always delegates
  // through the ref so re-renders don't reset subscriptions
  const stableSubscribe = useCallback(
    (onStoreChange: () => void) => pinnedDevtools.current.subscribe(onStoreChange),
    [],
  );
  const stableGetSnapshot = useCallback(() => pinnedDevtools.current.getSnapshot(), []);

  // This re-renders whenever the pinned observer fires (any provider event)
  useSyncExternalStore(stableSubscribe, stableGetSnapshot);

  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>('providers');
  const [search, setSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'recent'>('name');
  const [expandedId, setExpandedId] = useState<symbol | null>(null);
  const [position, setPosition] = useState(defaultPosition ?? { x: 16, y: 16 });
  const [maxEvents, setMaxEvents] = useState(() => pinnedDevtools.current.getMaxEvents?.() ?? 100);
  const [graphRoot, setGraphRoot] = useState<string | null>(null);

  // ── Drag handling ──────────────────────────────────────────
  const { onMouseDown } = useDraggable(position, setPosition);

  // ── Read data from pinned devtools & container ──────────────
  const rawSnapshots = container.getProviderStates();
  const events = pinnedDevtools.current.getEvents();

  // ── Sort snapshots ──────────────────────────────────────────
  const snapshots = useMemo(() => {
    if (sortMode === 'name') {
      return [...rawSnapshots].sort((a, b) => a.name.localeCompare(b.name));
    }
    // sortMode === 'recent'
    const latestMap = new Map<symbol, number>();
    for (const e of events) {
      if (!latestMap.has(e.providerId)) latestMap.set(e.providerId, e.timestamp);
    }
    return [...rawSnapshots].sort((a, b) => {
      const aTime = latestMap.get(a.id) ?? 0;
      const bTime = latestMap.get(b.id) ?? 0;
      return bTime - aTime;
    });
  }, [rawSnapshots, events, sortMode]);

  // ── Filtered providers ─────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return snapshots;
    const lower = search.toLowerCase();
    return snapshots.filter((s) => s.name.toLowerCase().includes(lower) || s.kind.toLowerCase().includes(lower));
  }, [snapshots, search]);

  // ── Filtered events ────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!eventSearch) return events;
    const lower = eventSearch.toLowerCase();
    return events.filter((e) => e.providerName.toLowerCase().includes(lower) || e.type.toLowerCase().includes(lower));
  }, [events, eventSearch]);

  // ── Keyboard shortcut (Ctrl+Shift+D) ──────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Max events sync ────────────────────────────────────────
  useEffect(() => {
    pinnedDevtools.current.setMaxEvents(maxEvents);
  }, [maxEvents]);

  if (!open) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) return null;
    return (
      <button className="rd-toggle-btn" onClick={() => setOpen(true)} title="Open River DevTools (Ctrl+Shift+D)">
        🌊
      </button>
    );
  }

  return (
    <div className="river-devtools">
      <div className="rd-panel" style={{ position: 'fixed', left: position.x, top: position.y }}>
        {/* Header */}
        <div className="rd-header" onMouseDown={onMouseDown}>
          <div className="rd-header-title">
            <span className="rd-header-logo">🌊</span>
            River DevTools
            <span className="rd-header-badge">{snapshots.length}</span>
          </div>
          <div className="rd-header-actions">
            <button className="rd-icon-btn" onClick={() => setOpen(false)} title="Close (Ctrl+Shift+D)">
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="rd-tabs">
          <button className="rd-tab" data-active={tab === 'providers'} onClick={() => setTab('providers')}>
            Providers
          </button>
          <button className="rd-tab" data-active={tab === 'events'} onClick={() => setTab('events')}>
            Events {events.length > 0 && <span className="rd-tab-count">{events.length}</span>}
          </button>
          <button className="rd-tab" data-active={tab === 'graph'} onClick={() => setTab('graph')}>
            Graph
          </button>
        </div>

        {/* Provider Tab */}
        {tab === 'providers' && (
          <>
            <div className="rd-search-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="rd-search-input"
                placeholder="Search providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button
                  className="rd-sort-btn"
                  data-active={sortMode === 'name'}
                  onClick={() => setSortMode('name')}
                  title="Sort by name"
                >
                  A-Z
                </button>
                <button
                  className="rd-sort-btn"
                  data-active={sortMode === 'recent'}
                  onClick={() => setSortMode('recent')}
                  title="Sort by recent updates"
                >
                  Recent
                </button>
              </div>
            </div>
            <div className="rd-content">
              {filtered.length === 0 ? (
                <div className="rd-empty">
                  <div className="rd-empty-icon">📦</div>
                  <div className="rd-empty-text">
                    {search ? 'No providers match your search' : 'No providers initialized yet'}
                  </div>
                </div>
              ) : (
                <div className="rd-provider-list">
                  {filtered.map((snap) => (
                    <ProviderItem
                      key={snap.name}
                      snapshot={snap}
                      expanded={expandedId === snap.id}
                      onToggle={() => setExpandedId((prev) => (prev === snap.id ? null : snap.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <>
            <div className="rd-search-wrap" style={{ display: 'flex', gap: 8 }}>
              <input
                className="rd-search-input"
                placeholder="Search events…"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <div className="rd-settings" style={{ padding: 0, border: 'none' }}>
                <label>
                  Max:
                  <input
                    type="number"
                    value={maxEvents}
                    min={1}
                    max={500}
                    onChange={(e) => setMaxEvents(Number(e.target.value) || 100)}
                  />
                </label>
                <button className="rd-icon-btn" onClick={() => pinnedDevtools.current.clearEvents()} title="Clear">
                  <IconTrash />
                </button>
              </div>
            </div>
            <div className="rd-content">
              {filteredEvents.length === 0 ? (
                <div className="rd-empty">
                  <div className="rd-empty-icon">📋</div>
                  <div className="rd-empty-text">No events match</div>
                </div>
              ) : (
                <div className="rd-event-list">
                  {filteredEvents.map((event, i) => (
                    <EventItem key={`${event.timestamp}-${i}`} event={event} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Graph Tab */}
        {tab === 'graph' && (
          <div className="rd-content">
            <DependencyGraph
              snapshots={snapshots}
              graphRoot={graphRoot}
              onSetRoot={setGraphRoot}
              onResetRoot={() => setGraphRoot(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
