/**
 * Graph construction and query helpers.
 *
 * A `CampusGraph` is the single in-memory representation the routing engine and
 * the teaching views both read from, so the algorithm and the on-screen map can
 * never drift apart.
 *
 *   G = (V, E)   V = locations,  E = walkable paths
 *
 * Two representations are built from the same source data:
 *   - an adjacency list (what Dijkstra and BFS traverse)
 *   - an adjacency matrix (what the Discrete Structures page displays)
 */

import type {
  AdjacencyList,
  CampusEdge,
  CampusLocation,
  GraphStats,
} from '@/types/campus';

export interface CampusGraph {
  locations: Map<string, CampusLocation>;
  edges: Map<string, CampusEdge>;
  /** node id -> outgoing edges. */
  adjacency: AdjacencyList;
  /** Stable, display-ordered node ids. */
  nodes: string[];
}

export interface BuildGraphOptions {
  /** Include locations flagged `isActive === false`. Default false. */
  includeInactive?: boolean;
  /** Include paths flagged `walkable === false`. Default false. */
  includeClosedPaths?: boolean;
}

/**
 * Builds a graph from Firestore-shaped data.
 *
 * Defensive by design: an edge whose endpoints are missing, whose distance is
 * not a positive finite number, or which points at an inactive location is
 * skipped and reported in `warnings` instead of throwing. Missing or malformed
 * campus data must never crash the map.
 */
export function buildGraph(
  locations: CampusLocation[],
  edges: CampusEdge[],
  options: BuildGraphOptions = {},
): { graph: CampusGraph; warnings: string[] } {
  const warnings: string[] = [];
  const { includeInactive = false, includeClosedPaths = false } = options;

  const locMap = new Map<string, CampusLocation>();
  for (const location of locations) {
    if (!location?.id) {
      warnings.push('Skipped a location with no id.');
      continue;
    }
    if (!includeInactive && !location.isActive) {
      warnings.push(`Location "${location.name || location.id}" is inactive and was excluded.`);
      continue;
    }
    locMap.set(location.id, location);
  }

  const edgeMap = new Map<string, CampusEdge>();
  const adjacency: AdjacencyList = {};
  for (const id of locMap.keys()) adjacency[id] = [];

  // Sorted endpoint pair -> edge id currently stored for it, so a duplicate
  // connection can be detected and collapsed rather than doubled.
  const seenPairs = new Map<string, string>();

  for (const edge of edges) {
    if (!edge?.id || !edge.from || !edge.to) {
      warnings.push('Skipped a path with a missing id, "from", or "to".');
      continue;
    }
    if (!locMap.has(edge.from)) {
      warnings.push(
        `Path "${edge.id}" references unknown location "${edge.from}" and was ignored.`,
      );
      continue;
    }
    if (!locMap.has(edge.to)) {
      warnings.push(`Path "${edge.id}" references unknown location "${edge.to}" and was ignored.`);
      continue;
    }
    if (edge.from === edge.to) {
      warnings.push(`Path "${edge.id}" is a self-loop and was ignored.`);
      continue;
    }
    if (!Number.isFinite(edge.distance) || edge.distance <= 0) {
      warnings.push(
        `Path "${edge.id}" has an invalid distance (${edge.distance}) and was ignored.`,
      );
      continue;
    }
    if (!includeClosedPaths && !edge.walkable) {
      // Deliberately silent. A closed path is a first-class operational state that
      // the admin dashboard surfaces in its own list and the map draws as a dashed
      // line; it is not a data fault. Warnings are reserved for malformed input.
      continue;
    }

    // Collapse duplicate connections: keep the shorter of the two distances.
    const key = [edge.from, edge.to].sort().join('~');
    const existingId = seenPairs.get(key);
    if (existingId) {
      const existing = edgeMap.get(existingId)!;
      if (existing.distance <= edge.distance) {
        warnings.push(
          `Duplicate path ${edge.from} - ${edge.to} ignored (kept the shorter ${existing.distance}m).`,
        );
        continue;
      }
      warnings.push(
        `Duplicate path ${edge.from} - ${edge.to}: replaced ${existing.distance}m with ${edge.distance}m.`,
      );
      detach(adjacency, existing);
      edgeMap.delete(existingId);
      seenPairs.delete(key);
    }

    edgeMap.set(edge.id, edge);
    seenPairs.set(key, edge.id);
    link(adjacency, edge);
  }

  // Sorting each neighbour list keeps Dijkstra's iteration deterministic, which
  // matters for reproducing the exact visit order shown on the teaching page.
  for (const id of Object.keys(adjacency)) {
    adjacency[id].sort((a, b) => a.distance - b.distance || a.node.localeCompare(b.node));
  }

  const nodes = [...locMap.keys()].sort((a, b) => {
    const la = locMap.get(a)!;
    const lb = locMap.get(b)!;
    return (la.sortOrder ?? 999) - (lb.sortOrder ?? 999) || la.name.localeCompare(lb.name);
  });

  return { graph: { locations: locMap, edges: edgeMap, adjacency, nodes }, warnings };
}

/** Adds an edge to the adjacency list honouring its direction constraint. */
function link(adjacency: AdjacencyList, edge: CampusEdge) {
  const forward = edge.direction !== 'backward';
  const backward = edge.direction !== 'forward';
  if (forward) adjacency[edge.from].push({ node: edge.to, distance: edge.distance, edgeId: edge.id });
  if (backward) adjacency[edge.to].push({ node: edge.from, distance: edge.distance, edgeId: edge.id });
}

/** Removes an edge from the adjacency list (used when collapsing duplicates). */
function detach(adjacency: AdjacencyList, edge: CampusEdge) {
  for (const key of [edge.from, edge.to]) {
    adjacency[key] = adjacency[key].filter((item) => item.edgeId !== edge.id);
  }
}

/** Nearest outgoing neighbour of `nodeId`, or undefined for an unknown node. */
export function neighbours(graph: CampusGraph, nodeId: string) {
  return graph.adjacency[nodeId] ?? [];
}

export function hasNode(graph: CampusGraph, nodeId: string): boolean {
  return graph.locations.has(nodeId);
}

export function nodeName(graph: CampusGraph, nodeId: string): string {
  return graph.locations.get(nodeId)?.name ?? nodeId;
}

/**
 * Number of vertices V.
 */
export function vertexCount(graph: CampusGraph): number {
  return graph.locations.size;
}

/**
 * Number of edges E, counting each stored path once.
 */
export function edgeCount(graph: CampusGraph): number {
  return graph.edges.size;
}

/**
 * Summary statistics used by the admin dashboard and the Discrete Structures page.
 *
 * Density uses the simple-graph formula 2E / (V * (V - 1)); it is undefined for
 * V < 2.
 */
export function computeStats(graph: CampusGraph): GraphStats {
  const vertices = graph.locations.size;
  const edges = graph.edges.size;

  // Degree and density are the *undirected* notions: each stored path counts once
  // at each of its two endpoints regardless of the direction restriction. Using
  // the directed adjacency length here instead would make averageDegree disagree
  // with 2E/V and with the density formula below whenever a one-way path exists.
  const degree: Record<string, number> = {};
  for (const id of graph.nodes) degree[id] = 0;
  for (const edge of graph.edges.values()) {
    degree[edge.from] = (degree[edge.from] ?? 0) + 1;
    degree[edge.to] = (degree[edge.to] ?? 0) + 1;
  }

  // Connected components, ignoring edge direction.
  const undirected = new Map<string, string[]>();
  for (const id of graph.nodes) undirected.set(id, []);
  for (const edge of graph.edges.values()) {
    undirected.get(edge.from)!.push(edge.to);
    undirected.get(edge.to)!.push(edge.from);
  }

  const seen = new Set<string>();
  const componentSizes: number[] = [];
  for (const id of graph.nodes) {
    if (seen.has(id)) continue;
    let size = 0;
    const queue = [id];
    seen.add(id);
    while (queue.length) {
      const current = queue.shift()!;
      size += 1;
      for (const next of undirected.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    componentSizes.push(size);
  }
  componentSizes.sort((a, b) => b - a);

  const totalDegree = Object.values(degree).reduce((sum, value) => sum + value, 0);

  return {
    vertices,
    edges,
    walkableEdges: [...graph.edges.values()].filter((edge) => edge.walkable).length,
    components: componentSizes.length,
    componentSizes,
    density: vertices > 1 ? (2 * edges) / (vertices * (vertices - 1)) : 0,
    averageDegree: vertices > 0 ? totalDegree / vertices : 0,
    selfLoops: [...graph.edges.values()].filter((edge) => edge.from === edge.to).length,
    degree,
  };
}

/**
 * Every vertex, with its coordinates, sorted so that adjacent entries in the list
 * can be joined by a straight or elbowed line without crossings on a grid layout.
 */
export function layoutNodes(graph: CampusGraph): CampusLocation[] {
  return graph.nodes.map((id) => graph.locations.get(id)!);
}