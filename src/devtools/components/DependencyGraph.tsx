import { useMemo } from 'react';
import type { DevToolsProviderSnapshot } from '../../core/container';
import {
  buildGraphLayout,
  getConnectedNodes,
  KIND_FILL,
  KIND_STROKE,
} from '../utils';
import { IconChevronLeft, IconHome } from './Icons';

interface DependencyGraphProps {
  snapshots: DevToolsProviderSnapshot[];
  graphRoot: string | null;
  onSetRoot: (name: string) => void;
  onResetRoot: () => void;
}

/** Component for the dependency graph visualization */
export function DependencyGraph({
  snapshots,
  graphRoot,
  onSetRoot,
  onResetRoot,
}: DependencyGraphProps) {
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
              <IconChevronLeft />
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
