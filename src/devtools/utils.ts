import type { DevToolsProviderSnapshot } from '../core/container';

/** Serializes a value for display in the DevTools */
export function serializeValue(value: unknown): string {
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

/** Formats a timestamp for display */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
}

/** Converts a provider kind to a short string for badges */
export function kindLabel(kind: string): string {
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

// ── Graph Utils ──────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

/** Returns all node names reachable (ancestors + descendants) from a starting node */
export function getConnectedNodes(
  snapshots: DevToolsProviderSnapshot[],
  rootName: string,
): Set<string> {
  const reachable = new Set<string>();
  reachable.add(rootName);

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
      // For groups, dependents contains actual dependents. The layout primarily relies on dependencies,
      // but to walk downwards, checking `snap.dependencies.includes(name)` works perfectly.
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

/** Merges developer tools snapshots of family instances into single nodes */
export function groupFamilySnapshots(
  snapshots: DevToolsProviderSnapshot[],
): DevToolsProviderSnapshot[] {
  const grouped = new Map<string, DevToolsProviderSnapshot>();
  const nameMapping = new Map<string, string>(); // Maps original name -> base name

  // Step 1: Assign a base name to every snapshot
  for (const s of snapshots) {
    const match = s.name.match(/^(.+?)\(.*\)$/);
    const baseName = match ? `${match[1]}(ƒ)` : s.name;
    nameMapping.set(s.name, baseName);

    if (!grouped.has(baseName)) {
      // Create a merged snapshot template
      // We purposefully do not copy the dependents / dependencies directly here,
      // because we want to de-duplicate them next
      grouped.set(baseName, {
        ...s,
        id: Symbol(baseName),
        name: baseName,
        dependencies: [],
        dependents: [],
      });
    }
  }

  // Step 2: Merge subsets (specifically their dependencies)
  for (const s of snapshots) {
    const baseName = nameMapping.get(s.name)!;
    const merged = grouped.get(baseName)!;

    // Map original dependencies to their new base names and union them
    for (const dep of s.dependencies) {
      const depBase = nameMapping.get(dep) || dep;
      if (depBase !== baseName && !merged.dependencies.includes(depBase)) {
        merged.dependencies.push(depBase);
      }
    }
    
    // We can optionally merge dependents too, but for building the graph layout,
    // only `dependencies` field is technically required by getConnectedNodes and buildGraphLayout.
    for (const dep of s.dependents) {
      const depBase = nameMapping.get(dep) || dep;
      if (depBase !== baseName && !merged.dependents.includes(depBase)) {
        merged.dependents.push(depBase);
      }
    }
  }

  return Array.from(grouped.values());
}

/** Computes the SVG layout for the dependency graph */
export function buildGraphLayout(
  items: DevToolsProviderSnapshot[],
): { nodes: GraphNode[]; edges: GraphEdge[]; viewBox: string; width: number; height: number } {
  if (items.length === 0) {
    return { nodes: [], edges: [], viewBox: '0 0 400 200', width: 400, height: 200 };
  }

  // Compute dependency depth for layout columns
  const depthMap = new Map<string, number>();
  const itemMap = new Map<string, DevToolsProviderSnapshot>();
  for (const s of items) itemMap.set(s.name, s);
  
  const visited = new Set<string>();

  function getDepth(name: string): number {
    if (visited.has(name)) return 0; // Break circular
    
    const cached = depthMap.get(name);
    if (cached !== undefined) return cached;
    
    visited.add(name);

    const snap = itemMap.get(name);
    if (!snap || snap.dependencies.length === 0) {
      visited.delete(name);
      depthMap.set(name, 0);
      return 0;
    }

    let maxDep = -1;
    for (const d of snap.dependencies) {
      if (itemMap.has(d)) {
        const dDepth = getDepth(d);
        if (dDepth > maxDep) maxDep = dDepth;
      }
    }

    visited.delete(name);
    
    const depth = maxDep === -1 ? 0 : maxDep + 1;
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

  const nodeWidth = 180; // Increased width to show more text
  const nodeHeight = 34;
  const colGap = 220; // Increased colGap to fit wider nodes without overlapping
  const rowGap = 52;
  const padX = 24;
  const padY = 24;

  const maxDepth = Math.max(...Array.from(groups.keys()), 0);
  const graphNodes: GraphNode[] = [];

  for (let col = 0; col <= maxDepth; col++) {
    const colItems = groups.get(col) ?? [];
    const colHeight = colItems.length * rowGap;
    const maxColHeight =
      Math.max(...Array.from(groups.values()).map((v) => v.length)) * rowGap;
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

  return { nodes: graphNodes, edges: graphEdges, viewBox: `0 0 ${maxX} ${maxY}`, width: maxX, height: maxY };
}

export const KIND_FILL: Record<string, string> = {
  provider: 'rgba(96,165,250,0.2)',
  stateProvider: 'rgba(74,222,128,0.2)',
  promiseProvider: 'rgba(250,204,21,0.2)',
  observableProvider: 'rgba(34,211,238,0.2)',
  notifierProvider: 'rgba(251,146,60,0.2)',
  asyncNotifierProvider: 'rgba(250,204,21,0.2)',
};

export const KIND_STROKE: Record<string, string> = {
  provider: '#60a5fa',
  stateProvider: '#4ade80',
  promiseProvider: '#facc15',
  observableProvider: '#22d3ee',
  notifierProvider: '#fb923c',
  asyncNotifierProvider: '#facc15',
};
