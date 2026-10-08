/**
 * Dijkstra's shortest-path algorithm for positively weighted graphs.
 *
 * Dijkstra solves the single-source shortest-path problem: given a start vertex
 * it computes, for every vertex v, the minimum total edge weight of any path from
 * the start to v. Because our walking paths all carry a positive distance in
 * metres, every edge weight is non-negative and the greedy "finalise the closest
 * unsettled vertex" step is provably safe.
 *
 * Why not BFS for routing? Breadth-first search minimises the number of edges, not
 * the distance walked. On a campus where a direct 5 m gap sits behind a 400 m
 * corridor, BFS happily returns the long way round. Dijkstra minimises actual
 * walking distance, which is what a user asking for a route cares about.
 *
 *   Time complexity  O((V + E) log V)  with the binary heap below
 *   Space complexity O(V + E)
 *
 * The implementation returns more than the bare path: `visitOrder` and
 * `relaxations` are recorded so the Discrete Structures page can visualise the
 * real run against the live campus graph rather than a hand-written example.
 */

import type { PathResult } from '@/types/campus';
import type { CampusGraph } from './graph';

const UNREACHABLE = -1;

/** A binary min-heap of (distance, vertex) pairs, keyed on distance. */
class MinHeap {
  private items: Array<{ distance: number; vertex: string }> = [];

  get size(): number {
    return this.items.length;
  }

  push(distance: number, vertex: string) {
    this.items.push({ distance, vertex });
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].distance <= this.items[index].distance) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  pop(): { distance: number; vertex: string } | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.items[left].distance < this.items[smallest].distance) {
          smallest = left;
        }
        if (right < this.items.length && this.items[right].distance < this.items[smallest].distance) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
        index = smallest;
      }
    }
    return top;
  }
}

/**
 * Computes the shortest path from `start` to `destination`.
 *
 * Returns `reachable: false` when the destination is unknown, when `start` equals
 * a different unknown node, or when no path exists. Callers get an empty `path`
 * and `distance: -1` in those cases rather than an exception.
 */
export function dijkstra(
  graph: CampusGraph,
  start: string,
  destination: string,
): PathResult {
  const empty: PathResult = {
    path: [],
    distance: UNREACHABLE,
    reachable: false,
    edgeIds: [],
    visitOrder: [],
    relaxations: 0,
  };

  if (!graph.locations.has(start) || !graph.locations.has(destination)) return empty;

  // Staying put is a legitimate request: cost 0, one vertex, no edges.
  if (start === destination) {
    return { ...empty, path: [start], distance: 0, reachable: true };
  }

  /** Best known distance from `start` to each vertex. */
  const dist = new Map<string, number>([[start, 0]]);
  /** Predecessor used to rebuild the path. */
  const previous = new Map<string, string>();
  /** Predecessor edge, kept so the UI can label each leg. */
  const previousEdge = new Map<string, string>();
  /** Vertices whose minimum distance is final. */
  const settled = new Set<string>();

  const heap = new MinHeap();
  heap.push(0, start);

  const visitOrder: string[] = [];
  let relaxations = 0;

  while (heap.size > 0) {
    const current = heap.pop()!;
    const u = current.vertex;
    const d = current.distance;

    // A stale heap entry for an already-settled vertex: skip it.
    if (settled.has(u)) continue;
    settled.add(u);
    visitOrder.push(u);

    // Early exit once the destination is final: its distance cannot improve.
    if (u === destination) break;

    for (const edge of graph.adjacency[u] ?? []) {
      const v = edge.node;
      if (settled.has(v)) continue;

      const candidate = d + edge.distance;
      relaxations += 1;

      if (candidate < (dist.get(v) ?? Infinity)) {
        dist.set(v, candidate);
        previous.set(v, u);
        previousEdge.set(v, edge.edgeId);
        heap.push(candidate, v);
      }
    }
  }

  if (!settled.has(destination) || !dist.has(destination)) {
    return { ...empty, visitOrder, relaxations };
  }

  // Walk the predecessor chain backwards, then reverse it into start -> target order.
  const reversed: string[] = [];
  const edgeIds: string[] = [];
  let cursor: string | undefined = destination;
  while (cursor) {
    reversed.push(cursor);
    if (cursor === start) break;
    const edgeId = previousEdge.get(cursor);
    if (edgeId) edgeIds.push(edgeId);
    cursor = previous.get(cursor);
  }

  if (reversed[reversed.length - 1] !== start) {
    // Defensive: a cycle in `previous` should be impossible, but never hand back
    // a malformed route.
    return { ...empty, visitOrder, relaxations };
  }

  return {
    path: reversed.reverse(),
    distance: dist.get(destination)!,
    reachable: true,
    edgeIds: edgeIds.reverse(),
    visitOrder,
    relaxations,
  };
}

/**
 * Runs Dijkstra from `start` to every reachable vertex in one pass.
 *
 * Dijkstra settles each vertex exactly once, so a single run yields an all-pairs
 * distance table more cheaply than |V| separate runs. The admin dashboard uses
 * this to show the shortest distance between any two buildings at a glance.
 */
export function dijkstraFromSource(
  graph: CampusGraph,
  start: string,
): Record<string, number> {
  const table: Record<string, number> = {};
  if (!graph.locations.has(start)) return table;

  const dist = new Map<string, number>([[start, 0]]);
  const settled = new Set<string>();
  const heap = new MinHeap();
  heap.push(0, start);

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (settled.has(current.vertex)) continue;
    settled.add(current.vertex);
    table[current.vertex] = current.distance;

    for (const edge of graph.adjacency[current.vertex] ?? []) {
      if (settled.has(edge.node)) continue;
      const candidate = current.distance + edge.distance;
      if (candidate < (dist.get(edge.node) ?? Infinity)) {
        dist.set(edge.node, candidate);
        heap.push(candidate, edge.node);
      }
    }
  }

  return table;
}