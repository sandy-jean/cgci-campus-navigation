/**
 * Breadth-first search, used for two distinct jobs in this application:
 *
 *   1. Reachability - answering "can B be reached from A?" - because on an
 *      unweighted graph BFS explores in layers, so the first time a vertex is
 *      discovered its distance in *edges* is already minimal.
 *   2. Connected components and the "no route available" explanation.
 *
 * BFS is the right tool for reachability but the wrong tool for routing: it
 * minimises the number of edges crossed, not the metres walked. That is precisely
 * why this project uses BFS for reachability and Dijkstra for routing.
 *
 *   Time complexity  O(V + E)
 *   Space complexity O(V)
 */

import type { BfsResult } from '@/types/campus';
import type { CampusGraph } from './graph';

/**
 * Breadth-first traversal from `start`.
 *
 * Never throws: an unknown start vertex returns an empty result.
 */
export function bfs(graph: CampusGraph, start: string, maxDepth = Infinity): BfsResult {
  const result: BfsResult = { order: [], hops: {}, visited: new Set<string>() };
  if (!graph.locations.has(start)) return result;

  const queue: string[] = [start];
  result.visited.add(start);
  result.hops[start] = 0;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const depth = result.hops[current];
    if (depth >= maxDepth) continue;

    // Only follow edges whose direction permits travelling out of `current`.
    for (const edge of graph.adjacency[current] ?? []) {
      if (result.visited.has(edge.node)) continue;
      result.visited.add(edge.node);
      result.hops[edge.node] = depth + 1;
      queue.push(edge.node);
    }
  }

  result.order = queue;
  return result;
}

/**
 * Reachability test: is `destination` reachable from `start`?
 *
 * Returns false immediately when either endpoint is not a vertex, which keeps the
 * "destination cannot be reached" message honest for stale or mistyped ids.
 */
export function isReachable(
  graph: CampusGraph,
  start: string,
  destination: string,
): boolean {
  if (!graph.locations.has(start) || !graph.locations.has(destination)) return false;
  if (start === destination) return true;
  return bfs(graph, start).visited.has(destination);
}

/**
 * The set of vertices reachable from `start`, as a plain array.
 * Useful for highlighting the subgraph a node can actually reach.
 */
export function reachableSet(graph: CampusGraph, start: string): string[] {
  return bfs(graph, start).order;
}

/**
 * Vertices that are not reachable from `start`.
 *
 * On the Discrete Structures page this demonstrates the difference between
 * "reachable in some direction" and "reachable from here": if the campus graph is
 * strongly connected this is empty, otherwise it names the stranded buildings.
 */
export function unreachableFrom(graph: CampusGraph, start: string): string[] {
  if (!graph.locations.has(start)) return [...graph.nodes];
  const visited = bfs(graph, start).visited;
  return graph.nodes.filter((id) => !visited.has(id));
}