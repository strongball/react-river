/* ════════════════════════════════════════════════════════════════
 *  React River — DevTools Floating Panel
 *  A draggable, collapsible panel showing all provider states.
 *
 *  ⚠ Uses RiverObserver for change detection — does NOT subscribe
 *  or listen to providers, so auto-dispose is never affected.
 * ════════════════════════════════════════════════════════════════ */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { useRiverContainer } from '../react/scope';

import type { DevToolsProviderSnapshot } from '../core/container';
import type { DevToolsEvent, DevToolsObserverHandle } from './devtools-observer';

import { injectDevToolsStyles } from './inject-styles';

// Inject styles at module load time — no CSS import needed by consumers
injectDevToolsStyles();

// ── Types ──────────────────────────────────────────────────────

export interface RiverDevToolsProps {
  devtools: DevToolsObserverHandle;
  /** Default position of the panel */
  defaultPosition?: { x: number; y: number };
  /** Default open state */
  defaultOpen?: boolean;
}

type Tab = 'providers' | 'events' | 'graph';

// ── Value Serializer ───────────────────────────────────────────

function serializeValue(value: unknown): string {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
    if (typeof value === 'symbol') return value.toString();

    // AsyncValue
    if (typeof value === 'object' && value !== null && 'status' in value) {
      const av = value as { status: string; data?: unknown; error?: unknown };
      if (av.status === 'loading') return '⏳ AsyncLoading';
      if (av.status === 'error') return `❌ AsyncError: ${String(av.error)}`;
      if (av.status === 'data') return `✅ ${JSON.stringify(av.data, null, 2)}`;
    }

    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
}

// ── SVG Icons ──────────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

// ── Provider Item ──────────────────────────────────────────────

function ProviderItem({
  snapshot,
  expanded,
  onToggle,
}: {
  snapshot: DevToolsProviderSnapshot;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rd-provider-item" onClick={onToggle}>
      <div className="rd-provider-row">
        <span className={`rd-provider-kind rd-kind-${snapshot.kind}`}>
          {kindLabel(snapshot.kind)}
        </span>
        <span className="rd-provider-name" title={snapshot.name}>
          {snapshot.name}
        </span>
        <div className="rd-provider-meta">
          <span title="Listeners">
            <IconEye />
            {snapshot.listenerCount}
          </span>
          <span title="Version">v{snapshot.version}</span>
          {snapshot.autoDispose && <span className="rd-badge-auto-dispose">AD</span>}
        </div>
      </div>

      {expanded && (
        <div className="rd-provider-details">
          <div className="rd-detail-row">
            <span className="rd-detail-label">Value</span>
            <span className="rd-detail-value">
              <pre>{serializeValue(snapshot.value)}</pre>
            </span>
          </div>

          {snapshot.previousValue !== undefined && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Previous</span>
              <span className="rd-detail-value">
                <pre>{serializeValue(snapshot.previousValue)}</pre>
              </span>
            </div>
          )}

          <div className="rd-detail-row">
            <span className="rd-detail-label">Kind</span>
            <span className="rd-detail-value">{snapshot.kind}</span>
          </div>

          <div className="rd-detail-row">
            <span className="rd-detail-label">Listeners</span>
            <span className="rd-detail-value">{snapshot.listenerCount}</span>
          </div>

          {snapshot.dependencies.length > 0 && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Depends on</span>
              <div className="rd-deps-list">
                {snapshot.dependencies.map((dep) => (
                  <span key={dep} className="rd-dep-tag">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {snapshot.dependents.length > 0 && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Used by</span>
              <div className="rd-deps-list">
                {snapshot.dependents.map((dep) => (
                  <span key={dep} className="rd-dep-tag">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {snapshot.autoDispose && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Cache Time</span>
              <span className="rd-detail-value">{snapshot.cacheTime ?? 0}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    provider: 'PROV',
    stateProvider: 'STATE',
    promiseProvider: 'ASYNC',
    observableProvider: 'OBS',
    notifierProvider: 'NTFY',
    asyncNotifierProvider: 'A·NTFY',
    notifierAccessor: 'ACC',
    promiseAccessor: 'P·ACC',
  };
  return map[kind] ?? kind;
}

// ── Event Item ─────────────────────────────────────────────────

function EventItem({ event }: { event: DevToolsEvent }) {
  return (
    <div className="rd-event-item">
      <span className={`rd-event-type rd-event-${event.type}`}>{event.type}</span>
      <div className="rd-event-body">
        <div className="rd-event-name">{event.providerName}</div>
        <div className="rd-event-kind">{event.providerKind}</div>
      </div>
      <span className="rd-event-time">{formatTime(event.timestamp)}</span>
    </div>
  );
}

// ── Dependency Graph ───────────────────────────────────────────

interface GraphNode {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

/** Returns all node names reachable (ancestors + descendants) from a starting node */
function getConnectedNodes(
  snapshots: DevToolsProviderSnapshot[],
  rootName: string,
): Set<string> {
  const reachable = new Set<string>([rootName]);

  function addAncestors(name: string) {
    const snap = snapshots.find((s) => s.name === name);
    if (!snap) return;
    for (const dep of snap.dependencies) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        addAncestors(dep);
      }
    }
  }

  function addDescendants(name: string) {
    for (const snap of snapshots) {
      if (!reachable.has(snap.name) && snap.dependencies.includes(name)) {
        reachable.add(snap.name);
        addDescendants(snap.name);
      }
    }
  }

  addAncestors(rootName);
  addDescendants(rootName);
  return reachable;
}

function buildGraphLayout(
  items: DevToolsProviderSnapshot[],
): { nodes: GraphNode[]; edges: GraphEdge[]; viewBox: string } {
  if (items.length === 0) {
    return { nodes: [], edges: [], viewBox: '0 0 400 200' };
  }

  // Compute dependency depth for layout columns
  const depthMap = new Map<string, number>();

  function getDepth(name: string, visited = new Set<string>()): number {
    if (visited.has(name)) return 0;
    visited.add(name);
    const cached = depthMap.get(name);
    if (cached !== undefined) return cached;

    const snap = items.find((s) => s.name === name);
    if (!snap || snap.dependencies.length === 0) {
      depthMap.set(name, 0);
      return 0;
    }

    const maxDep = Math.max(
      ...snap.dependencies
        .filter((d) => items.some((s) => s.name === d))
        .map((d) => getDepth(d, new Set(visited))),
    );
    const depth = maxDep + 1;
    depthMap.set(name, depth);
    return depth;
  }

  for (const s of items) getDepth(s.name);

  // Group by depth column
  const groups = new Map<number, DevToolsProviderSnapshot[]>();
  for (const s of items) {
    const d = depthMap.get(s.name) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(s);
  }

  const nodeWidth = 120;
  const nodeHeight = 34;
  const colGap = 170;
  const rowGap = 52;
  const padX = 24;
  const padY = 24;

  const maxDepth = Math.max(...groups.keys(), 0);
  const graphNodes: GraphNode[] = [];

  for (let col = 0; col <= maxDepth; col++) {
    const colItems = groups.get(col) ?? [];
    const colHeight = colItems.length * rowGap;
    const maxColHeight = Math.max(...[...groups.values()].map((v) => v.length)) * rowGap;
    const startY = padY + (maxColHeight - colHeight) / 2;

    for (let row = 0; row < colItems.length; row++) {
      const x = padX + col * colGap;
      const y = startY + row * rowGap;
      graphNodes.push({
        id: colItems[row].name,
        kind: colItems[row].kind,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
      });
    }
  }

  const graphEdges: GraphEdge[] = [];
  const nodeNames = new Set(graphNodes.map((n) => n.id));
  for (const s of items) {
    for (const dep of s.dependencies) {
      if (nodeNames.has(dep) && nodeNames.has(s.name)) {
        graphEdges.push({ from: dep, to: s.name });
      }
    }
  }

  const maxX = Math.max(...graphNodes.map((n) => n.x + n.width)) + padX;
  const maxY = Math.max(...graphNodes.map((n) => n.y + n.height)) + padY;

  return { nodes: graphNodes, edges: graphEdges, viewBox: `0 0 ${maxX} ${maxY}` };
}

const KIND_FILL: Record<string, string> = {
  provider: 'rgba(96,165,250,0.2)',
  stateProvider: 'rgba(74,222,128,0.2)',
  promiseProvider: 'rgba(250,204,21,0.2)',
  observableProvider: 'rgba(34,211,238,0.2)',
  notifierProvider: 'rgba(251,146,60,0.2)',
  asyncNotifierProvider: 'rgba(250,204,21,0.2)',
};

const KIND_STROKE: Record<string, string> = {
  provider: '#60a5fa',
  stateProvider: '#4ade80',
  promiseProvider: '#facc15',
  observableProvider: '#22d3ee',
  notifierProvider: '#fb923c',
  asyncNotifierProvider: '#facc15',
};

function DependencyGraph({
  snapshots,
  graphRoot,
  onSetRoot,
  onResetRoot,
}: {
  snapshots: DevToolsProviderSnapshot[];
  graphRoot: string | null;
  onSetRoot: (name: string) => void;
  onResetRoot: () => void;
}) {
  // Filter out accessors for clarity
  const allNodes = snapshots.filter(
    (s) => s.kind !== 'notifierAccessor' && s.kind !== 'promiseAccessor',
  );

  // When a root is selected, filter to connected subgraph
  const visibleNodes = useMemo(() => {
    if (!graphRoot) return allNodes;
    const connected = getConnectedNodes(allNodes, graphRoot);
    return allNodes.filter((s) => connected.has(s.name));
  }, [allNodes, graphRoot]);

  const { nodes, edges, viewBox } = useMemo(
    () => buildGraphLayout(visibleNodes),
    [visibleNodes],
  );

  if (allNodes.length === 0) {
    return (
      <div className="rd-empty">
        <div className="rd-empty-icon">🔗</div>
        <div className="rd-empty-text">No providers to visualize</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Graph toolbar */}
      <div className="rd-graph-toolbar">
        {graphRoot ? (
          <>
            <span className="rd-graph-breadcrumb">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {graphRoot}
            </span>
            <button className="rd-icon-btn" onClick={onResetRoot} title="Show full graph">
              <IconHome />
            </button>
          </>
        ) : (
          <span className="rd-graph-hint">Click a node to zoom in</span>
        )}
      </div>

      {/* SVG Graph */}
      <div className="rd-graph-container">
        <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker
              id="rd-arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(120,120,200,0.6)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.width;
            const y1 = fromNode.y + fromNode.height / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + toNode.height / 2;
            const mx = (x1 + x2) / 2;

            return (
              <path
                key={i}
                className="rd-graph-edge"
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isRoot = node.id === graphRoot;
            const label = node.id.length > 15 ? `${node.id.slice(0, 13)}…` : node.id;

            return (
              <g
                key={node.id}
                className="rd-graph-node"
                transform={`translate(${node.x},${node.y})`}
                onClick={() => onSetRoot(node.id)}
              >
                <rect
                  width={node.width}
                  height={node.height}
                  rx="6"
                  ry="6"
                  fill={KIND_FILL[node.kind] ?? 'rgba(136,136,170,0.15)'}
                  stroke={isRoot ? '#a78bfa' : (KIND_STROKE[node.kind] ?? '#8888aa')}
                  strokeWidth={isRoot ? 2 : 1.5}
                />
                <text x={node.width / 2} y={node.height / 2} dominantBaseline="central" textAnchor="middle">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main DevTools Component ────────────────────────────────────

export function RiverDevTools({
  devtools,
  defaultPosition,
  defaultOpen = false,
}: RiverDevToolsProps) {
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
  const stableGetSnapshot = useCallback(
    () => pinnedDevtools.current.getSnapshot(),
    [],
  );

  // This re-renders whenever the pinned observer fires (any provider event)
  useSyncExternalStore(stableSubscribe, stableGetSnapshot);

  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>('providers');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<symbol | null>(null);
  const [position, setPosition] = useState(defaultPosition ?? { x: 16, y: 16 });
  const [maxEvents, setMaxEvents] = useState(10);
  const [graphRoot, setGraphRoot] = useState<string | null>(null);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ── Read data from pinned devtools & container ──────────────
  const snapshots = container.getProviderStates();
  const events = pinnedDevtools.current.getEvents();

  // ── Filtered providers ─────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return snapshots;
    const lower = search.toLowerCase();
    return snapshots.filter(
      (s) => s.name.toLowerCase().includes(lower) || s.kind.toLowerCase().includes(lower),
    );
  }, [snapshots, search]);

  // ── Drag handling ──────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        if (!dragging.current) return;
        setPosition({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        });
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [position],
  );

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
    return (
      <button
        className="rd-toggle-btn"
        onClick={() => setOpen(true)}
        title="Open River DevTools (Ctrl+Shift+D)"
      >
        🌊
      </button>
    );
  }

  return (
    <div className="river-devtools">
      <div
        className="rd-panel"
        style={{ position: 'fixed', left: position.x, top: position.y }}
      >
        {/* Header */}
        <div className="rd-header" onMouseDown={onMouseDown}>
          <div className="rd-header-title">
            <span className="rd-header-logo">🌊</span>
            River DevTools
            <span className="rd-header-badge">{snapshots.length}</span>
          </div>
          <div className="rd-header-actions">
            <button
              className="rd-icon-btn"
              onClick={() => setOpen(false)}
              title="Close (Ctrl+Shift+D)"
            >
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
            <div className="rd-search-wrap">
              <input
                className="rd-search-input"
                placeholder="Search providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                      onToggle={() =>
                        setExpandedId((prev) => (prev === snap.id ? null : snap.id))
                      }
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
            <div className="rd-settings">
              <label>
                Max:
                <input
                  type="number"
                  value={maxEvents}
                  min={1}
                  max={500}
                  onChange={(e) => setMaxEvents(Number(e.target.value) || 10)}
                />
              </label>
              <button
                className="rd-icon-btn"
                onClick={() => pinnedDevtools.current.clearEvents()}
                title="Clear"
              >
                <IconTrash />
              </button>
            </div>
            <div className="rd-content">
              {events.length === 0 ? (
                <div className="rd-empty">
                  <div className="rd-empty-icon">📋</div>
                  <div className="rd-empty-text">No events recorded yet</div>
                </div>
              ) : (
                <div className="rd-event-list">
                  {events.map((event, i) => (
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
