/**
 * Adjacency-list view of the campus graph.
 *
 * The adjacency list is the representation the algorithms actually traverse. Each
 * vertex maps to the list of vertices reachable from it in one step, carrying the
 * edge weight alongside.
 *
 *   mainGate: [ { node: 'guardHouse', distance: 45 }, ... ]
 *
 * Compared with an adjacency matrix, the list costs O(V + E) to store instead of
 * O(V^2), which is why it is the primary representation for a sparse campus graph
 * while the matrix is kept as a demonstration.
 */

import type { AdjacencyList, CampusEdge, CampusLocation } from '@/types/campus';

/**
 * Builds the plain-object adjacency list shown in the teaching view.
 *
 * Values are objects rather than bare ids so the list stays readable as data and
 * doubles as a lightweight JSON export.
 */
export function toAdjacencyList(
  locations: CampusLocation[],
  edges: CampusEdge[],
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Record<string, Array<{ node: string; name: string; distance: number; edgeId: string }>> {
  const known = new Set(
    locations.filter((location) => includeInactive || location.isActive).map((location) => location.id),
  );

  const list: AdjacencyList = {};
  const names = new Map(locations.map((location) => [location.id, location.name]));
  for (const id of known) list[id] = [];

  for (const edge of edges) {
    if (!edge.walkable) continue;
    if (!known.has(edge.from) || !known.has(edge.to)) continue;
    if (edge.from === edge.to) continue;

    if (edge.direction !== 'backward') {
      list[edge.from].push({ node: edge.to, distance: edge.distance, edgeId: edge.id });
    }
    if (edge.direction !== 'forward') {
      list[edge.to].push({ node: edge.from, distance: edge.distance, edgeId: edge.id });
    }
  }

  const result = {} as Record<string, Array<{ node: string; name: string; distance: number; edgeId: string }>>;
  for (const [id, entries] of Object.entries(list)) {
    result[id] = entries
      .map((entry) => ({ ...entry, name: names.get(entry.node) ?? entry.node }))
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  }
  return result;
}

/**
 * Renders the adjacency list as the TypeScript literal from the project brief,
 * ready to paste into a report or a slide.
 */
export function adjacencyListToCode(list: Record<string, Array<{ node: string; distance: number }>>): string {
  const body = Object.entries(list)
    .map(([node, entries]) => {
      if (entries.length === 0) return `  ${node}: [],`;
      const inner = entries
        .map((entry) => `      { node: "${entry.node}", distance: ${entry.distance} },`)
        .join('\n');
      return `  ${node}: [\n${inner}\n    ],`;
    })
    .join('\n');
  return `const campusGraph = {\n${body}\n};`;
}

/**
 * Total number of adjacency entries. In an undirected graph each edge appears
 * twice, once per endpoint.
 */
export function adjacencyEntryCount(list: Record<string, unknown[]>): number {
  return Object.values(list).reduce((sum, entries) => sum + entries.length, 0);
}