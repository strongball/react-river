import { useMemo, useState, useRef, useEffect } from 'react';

import { buildGraphLayout, getConnectedNodes, groupFamilySnapshots, KIND_FILL, KIND_STROKE } from '../utils';
import { IconChevronLeft } from './Icons';

import type { DevToolsProviderSnapshot } from '../../core/container';

interface DependencyGraphProps {
  snapshots: DevToolsProviderSnapshot[];
  graphRoot: string | null;
  onSetRoot: (name: string) => void;
  onResetRoot: () => void;
}

/** Component for the dependency graph visualization */
export function DependencyGraph({ snapshots, graphRoot, onSetRoot, onResetRoot }: DependencyGraphProps) {
  const [scale, setScale] = useState(1);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  // Filter out accessors for clarity
  const filteredNodes = snapshots.filter((s) => s.kind !== 'notifierAccessor' && s.kind !== 'promiseAccessor');

  // Group family instances into single nodes
  const groupedNodes = useMemo(() => groupFamilySnapshots(filteredNodes), [filteredNodes]);

  // Remove hidden nodes and their edges
  const allNodes = useMemo(() => {
    if (hiddenNodes.size === 0) return groupedNodes;
    return groupedNodes
      .filter((n) => !hiddenNodes.has(n.name))
      .map((n) => ({
        ...n,
        dependencies: n.dependencies.filter((d) => !hiddenNodes.has(d)),
        dependents: n.dependents.filter((d) => !hiddenNodes.has(d)),
      }));
  }, [groupedNodes, hiddenNodes]);

  // When a root is selected, filter to connected subgraph
  const visibleNodes = useMemo(() => {
    if (!graphRoot) return allNodes;
    const connected = getConnectedNodes(allNodes, graphRoot);
    return allNodes.filter((s) => connected.has(s.name));
  }, [allNodes, graphRoot]);

  const { nodes, edges, viewBox, width, height } = useMemo(() => buildGraphLayout(visibleNodes), [visibleNodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const grabStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ left: 0, top: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── Mouse Drag Panning ──
    const handlePointerDown = (e: PointerEvent) => {
      // Do not pan if clicking on a node
      if ((e.target as Element).closest('.rd-graph-node')) return;
      isDragging.current = true;
      grabStart.current = { x: e.clientX, y: e.clientY };
      scrollStart.current = { left: el.scrollLeft, top: el.scrollTop };
      el.style.cursor = 'grabbing';
      el.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - grabStart.current.x;
      const dy = e.clientY - grabStart.current.y;
      el.scrollLeft = scrollStart.current.left - dx;
      el.scrollTop = scrollStart.current.top - dy;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging.current) {
        isDragging.current = false;
        el.style.cursor = 'grab';
        el.releasePointerCapture(e.pointerId);
      }
    };

    // ── Wheel Zooming ──
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((s) => Math.min(3.0, Math.max(0.2, Number((s + delta).toFixed(1)))));
      }
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
      <div
        className="rd-graph-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--rd-border)',
          flexShrink: 0,
          minHeight: 48,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {graphRoot ? (
            <>
              <button
                className="rd-graph-breadcrumb"
                onClick={onResetRoot}
                title="Return to full graph"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--rd-accent)',
                  background: 'rgba(124, 108, 240, 0.1)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(124, 108, 240, 0.2)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(124, 108, 240, 0.1)')}
              >
                <IconChevronLeft />
                {graphRoot}
              </button>
              <button
                className="rd-sort-btn"
                onClick={() => {
                  setHiddenNodes((prev) => new Set(prev).add(graphRoot));
                  onResetRoot();
                }}
                title="Hide this node from the graph to declutter"
              >
                Hide
              </button>
            </>
          ) : (
            <span className="rd-graph-hint" style={{ marginRight: 8 }}>
              Click a node to zoom in
            </span>
          )}

          {/* Hidden Nodes indicators */}
          {hiddenNodes.size > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.from(hiddenNodes).map((name) => (
                <button
                  key={name}
                  className="rd-dep-tag"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    border: '1px dashed var(--rd-red)',
                    padding: '2px 6px',
                    background: 'transparent',
                  }}
                  onClick={() => {
                    setHiddenNodes((prev) => {
                      const next = new Set(prev);
                      next.delete(name);
                      return next;
                    });
                  }}
                  title={`Restore ${name}`}
                >
                  <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{name}</span>
                  <span style={{ opacity: 0.8, color: 'var(--rd-red)' }}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="rd-icon-btn"
            style={{ width: 24, height: 24, fontSize: 13 }}
            onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.2).toFixed(1))))}
            title="Zoom out"
          >
            -
          </button>
          <span style={{ fontSize: 11, fontFamily: 'var(--rd-font-mono)', minWidth: 36, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            className="rd-icon-btn"
            style={{ width: 24, height: 24, fontSize: 13 }}
            onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.2).toFixed(1))))}
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* SVG Graph */}
      <div ref={containerRef} className="rd-graph-container" style={{ position: 'relative' }}>
        <svg
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{ minWidth: Math.max(width, 100) * scale, minHeight: Math.max(height, 100) * scale }}
        >
          <defs>
            <marker id="rd-arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
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

            return <path key={i} className="rd-graph-edge" d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />;
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isRoot = node.id === graphRoot;
            const label = node.id.length > 25 ? `${node.id.slice(0, 23)}…` : node.id;

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
