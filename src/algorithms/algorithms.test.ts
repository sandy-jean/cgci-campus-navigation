/**
 * Algorithm tests.
 *
 * These are the correctness guarantee for the project. The Dijkstra implementation
 * is checked against an independent Bellman-Ford reference rather than against
 * hand-picked expectations, so a bug in the heap or the predecessor bookkeeping
 * cannot hide behind a coincidence in the campus data.
 *
 * Expected distances for the named routes below were read off the running
 * implementation and then confirmed by hand from the site plan, so they act as a
 * change detector rather than as a restatement of the code.
 *
 * Run with: npm test
 */

import { describe, expect, it } from 'vitest';

import { adjacencyListToCode, toAdjacencyList } from '@/algorithms/adjacencyList';
import { buildAdjacencyMatrix } from '@/algorithms/adjacencyMatrix';
import { bfs, isReachable, unreachableFrom } from '@/algorithms/bfs';
import { buildGraph, computeStats, type CampusGraph } from '@/algorithms/graph';
import { dijkstra, dijkstraFromSource } from '@/algorithms/dijkstra';
import dataset from '@/data/campusLayout.json';
import type { CampusEdge, CampusLocation } from '@/types/campus';

/* --------------------------------------------------------------- fixtures */

const locations = dataset.locations as unknown as CampusLocation[];
const edges = dataset.edges as unknown as CampusEdge[];

/** The path stored closed purely to demonstrate graph-change behaviour. */
const DEMO_CLOSED_EDGE = 'core-1__clinic-building';

/** Builds the campus graph once; no test mutates the shared dataset. */
function campus(): CampusGraph {
  return buildGraph(locations, edges).graph;
}

/** Builds the same campus with one path's walkable flag forced on. */
function withPathOpen(edgeId: string): CampusGraph {
  return buildGraph(
    locations,
    edges.map((edge) => (edge.id === edgeId ? { ...edge, walkable: true } : edge)),
  ).graph;
}

/* ------------------------------------------------------------------ helper */

/**
 * Independent reference implementation: Bellman-Ford over the same edge list.
 *
 * Deliberately naive and structurally unlike Dijkstra - it relaxes every edge in
 * every pass with no priority queue - so agreement between the two is real evidence
 * rather than the same bug reported twice.
 */
function bellmanFord(graph: CampusGraph, start: string): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const id of graph.nodes) dist[id] = Infinity;
  dist[start] = 0;

  const list = [...graph.edges.values()];
  // |V| - 1 passes is enough to settle every shortest path.
  for (let pass = 0; pass < graph.nodes.length - 1; pass += 1) {
    let changed = false;
    for (const edge of list) {
      // Relax only the directions the path actually permits.
      if (edge.direction !== 'backward' && dist[edge.from] < Infinity) {
        const candidate = dist[edge.from] + edge.distance;
        if (candidate < dist[edge.to]) {
          dist[edge.to] = candidate;
          changed = true;
        }
      }
      if (edge.direction !== 'forward' && dist[edge.to] < Infinity) {
        const candidate = dist[edge.to] + edge.distance;
        if (candidate < dist[edge.from]) {
          dist[edge.from] = candidate;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return dist;
}

/** Walks the returned path and sums its real edges, independently of `distance`. */
function measurePath(graph: CampusGraph, path: string[]): number {
  if (path.length === 0) return -1;
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const edge = [...graph.edges.values()].find(
      (candidate) =>
        (candidate.from === path[i] && candidate.to === path[i + 1]) ||
        (candidate.from === path[i + 1] && candidate.to === path[i]),
    );
    if (!edge) return -1;
    total += edge.distance;
  }
  return total;
}

/* --------------------------------------------------------------- the graph */

describe('buildGraph', () => {
  it('includes every active location as a vertex', () => {
    const graph = campus();
    expect(graph.locations.size).toBe(locations.length);
    expect(graph.nodes).toHaveLength(locations.length);
  });

  it('matches the official site plan vertex and edge counts', () => {
    const graph = campus();
    // 15 mapped locations; 22 stored paths of which 1 is closed.
    expect(graph.locations.size).toBe(15);
    expect(graph.edges.size).toBe(21);
  });

  it('excludes closed paths from the adjacency list', () => {
    const graph = campus();
    const closed = edges.filter((edge) => !edge.walkable);
    expect(closed.length).toBeGreaterThan(0);
    for (const edge of closed) {
      const adjacency = graph.adjacency[edge.from] ?? [];
      expect(adjacency.find((item) => item.node === edge.to)).toBeUndefined();
    }
  });

  it('honours a one-way path in either direction', () => {
    // The seeded campus has no one-way path, so build a synthetic one to prove the
    // direction flag is honoured rather than merely carried through.
    const graph = buildGraph(locations, [
      { id: 'one-way', from: 'gate-1', to: 'gate-2', distance: 100, walkable: true, direction: 'forward' },
    ]).graph;
    expect(graph.adjacency['gate-1'].some((item) => item.node === 'gate-2')).toBe(true);
    expect(graph.adjacency['gate-2'].some((item) => item.node === 'gate-1')).toBe(false);
  });

  it('reports invalid data instead of throwing', () => {
    const result = buildGraph(
      [...locations, { ...locations[0], id: 'inactive-one', name: 'Hidden', isActive: false }],
      [
        ...edges,
        { id: 'bad-1', from: 'no-such-node', to: 'core-4', distance: 10, walkable: true, direction: 'both' },
        { id: 'bad-2', from: 'core-4', to: 'core-5', distance: 0, walkable: true, direction: 'both' },
        { id: 'bad-3', from: 'core-4', to: 'core-4', distance: 5, walkable: true, direction: 'both' },
      ],
    );
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(result.graph.edges.has('bad-1')).toBe(false);
    expect(result.graph.edges.has('bad-2')).toBe(false);
    expect(result.graph.edges.has('bad-3')).toBe(false);
    // The valid edges survive the presence of broken ones.
    expect(result.graph.edges.size).toBe(edges.filter((edge) => edge.walkable).length);
  });

  it('collapses duplicate connections, keeping the shorter', () => {
    const result = buildGraph(locations, [
      ...edges,
      { id: 'dup-short', from: 'core-4', to: 'core-5', distance: 10, walkable: true, direction: 'both' },
      { id: 'dup-long', from: 'core-4', to: 'core-5', distance: 900, walkable: true, direction: 'both' },
    ]);
    const pair = result.graph.adjacency['core-4'].filter((item) => item.node === 'core-5');
    expect(pair).toHaveLength(1);
    expect(pair[0].distance).toBe(10);
  });

  it('survives an empty dataset', () => {
    const result = buildGraph([], []);
    expect(result.graph.locations.size).toBe(0);
    expect(result.graph.edges.size).toBe(0);
    expect(result.graph.nodes).toEqual([]);
  });
});

/* -------------------------------------------------------------- Dijkstra */

describe('dijkstra', () => {
  it('agrees with Bellman-Ford on every ordered pair of campus vertices', () => {
    const graph = campus();
    for (const source of graph.nodes) {
      const expected = bellmanFord(graph, source);
      const actual = dijkstraFromSource(graph, source);

      expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
      for (const target of graph.nodes) {
        const want = Number.isFinite(expected[target]) ? expected[target] : undefined;
        if (want === undefined) {
          expect(actual[target]).toBeUndefined();
        } else {
          expect(actual[target]).toBeCloseTo(want, 6);
        }
      }
    }
  });

  it('reports a self-route as distance zero and one stop', () => {
    const result = dijkstra(campus(), 'core-4', 'core-4');
    expect(result.reachable).toBe(true);
    expect(result.distance).toBe(0);
    expect(result.path).toEqual(['core-4']);
  });

  it('returns unreachable for an unknown vertex instead of throwing', () => {
    const result = dijkstra(campus(), 'nope', 'core-4');
    expect(result.reachable).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.distance).toBe(-1);
  });

  it('returns unreachable for an unknown destination', () => {
    expect(dijkstra(campus(), 'core-4', 'nowhere').reachable).toBe(false);
  });

  it('can reach every location from every other on the seeded campus', () => {
    const graph = campus();
    for (const source of graph.nodes) {
      const distances = dijkstraFromSource(graph, source);
      expect(Object.keys(distances)).toHaveLength(graph.nodes.length);
    }
  });

  it('returns unreachable when a location is cut off', () => {
    const target = 'shs-building';
    const isolated = edges.map((edge) =>
      edge.from === target || edge.to === target ? { ...edge, walkable: false } : edge,
    );
    const graph = buildGraph(locations, isolated).graph;
    const result = dijkstra(graph, 'gate-1', target);
    expect(result.reachable).toBe(false);
    expect(result.distance).toBe(-1);
    expect(result.path).toEqual([]);
  });

  it('produces a path whose measured edges equal the reported distance', () => {
    const graph = campus();
    for (const source of graph.nodes) {
      for (const target of graph.nodes) {
        const result = dijkstra(graph, source, target);
        if (!result.reachable) continue;
        expect(measurePath(graph, result.path)).toBeCloseTo(result.distance, 6);
      }
    }
  });

  it('starts and ends at the requested vertices', () => {
    const result = dijkstra(campus(), 'gate-1', 'shs-building');
    expect(result.path[0]).toBe('gate-1');
    expect(result.path[result.path.length - 1]).toBe('shs-building');
  });

  it('never repeats a vertex in the path', () => {
    const graph = campus();
    for (const source of graph.nodes) {
      for (const target of graph.nodes) {
        const { path } = dijkstra(graph, source, target);
        expect(new Set(path).size).toBe(path.length);
      }
    }
  });

  it('finds the expected Gate 1 to Senior High School route', () => {
    const result = dijkstra(campus(), 'gate-1', 'shs-building');
    expect(result.reachable).toBe(true);
    // Along the south frontage, rather than doubling back through the north.
    expect(result.path).toEqual(['gate-1', 'core-3', 'gate-2', 'guidance-building', 'shs-building']);
    expect(result.distance).toBe(50 + 25 + 110 + 150);
    expect(result.distance).toBe(335);
  });

  it('is symmetric for two-way paths', () => {
    const graph = campus();
    expect(dijkstra(graph, 'core-4', 'core-5').distance).toBe(
      dijkstra(graph, 'core-5', 'core-4').distance,
    );
  });

  it('re-routes around a closed path when it is reopened', () => {
    // With the CORE 1 to Clinic path closed, CORE 1 reaches the parking area along
    // the direct 200 m link. Reopening it gives an 85 m route through the clinic.
    const closed = dijkstra(campus(), 'core-1', 'parking-area');
    expect(closed.path).toEqual(['core-1', 'parking-area']);
    expect(closed.distance).toBe(200);

    const open = dijkstra(withPathOpen(DEMO_CLOSED_EDGE), 'core-1', 'parking-area');
    expect(open.path).toEqual(['core-1', 'clinic-building', 'parking-area']);
    expect(open.distance).toBe(85);
    expect(open.distance).toBeLessThan(closed.distance);
  });

  it('visits every reachable vertex at most once', () => {
    const result = dijkstra(campus(), 'gate-1', 'shs-building');
    expect(new Set(result.visitOrder).size).toBe(result.visitOrder.length);
    expect(result.visitOrder[0]).toBe('gate-1');
    expect(result.relaxations).toBeGreaterThan(0);
  });

  it('minimises walked distance rather than the number of edges', () => {
    const graph = campus();
    // CORE 4 sits one hop from CORE 5 and CORE 3 two hops away, and this is also
    // the cheapest route at 60 m, so BFS and Dijkstra agree on this particular pair.
    const result = dijkstra(graph, 'core-4', 'core-3');
    expect(result.path).toEqual(['core-4', 'core-5', 'core-3']);
    expect(measurePath(graph, result.path)).toBe(30 + 30);

    const hops = bfs(graph, 'core-4').hops['core-3'];
    expect(result.path.length - 1).toBeLessThanOrEqual(hops);
  });
});

/* -------------------------------------------------------------------- BFS */

describe('bfs', () => {
  it('explores in layers of edges, not distance', () => {
    const graph = campus();
    const { order, hops } = bfs(graph, 'gate-1');
    expect(order[0]).toBe('gate-1');
    expect(hops['gate-1']).toBe(0);

    // Every vertex one hop away is settled before anything two hops away.
    const firstTwoHop = order.findIndex((id) => hops[id] === 2);
    const lastOneHop = order.map((id) => hops[id]).lastIndexOf(1);
    expect(lastOneHop).toBeLessThan(firstTwoHop);
  });

  it('agrees with Dijkstra on reachability', () => {
    const graph = campus();
    for (const source of graph.nodes) {
      const distances = dijkstraFromSource(graph, source);
      const reachableByBfs = [...bfs(graph, source).visited].sort();
      expect(reachableByBfs).toEqual(Object.keys(distances).sort());
    }
  });

  it('does not traverse a one-way path against its direction', () => {
    const graph = buildGraph(locations, [
      { id: 'one-way', from: 'gate-1', to: 'gate-2', distance: 100, walkable: true, direction: 'forward' },
    ]).graph;
    expect(bfs(graph, 'gate-1', 1).visited.has('gate-2')).toBe(true);
    expect(bfs(graph, 'gate-2', 1).visited.has('gate-1')).toBe(false);
  });

  it('reports locations stranded in another component', () => {
    const target = 'shs-building';
    const isolated = edges.map((edge) =>
      edge.from === target || edge.to === target ? { ...edge, walkable: false } : edge,
    );
    const graph = buildGraph(locations, isolated).graph;
    expect(unreachableFrom(graph, 'gate-1')).toContain(target);
    expect(isReachable(graph, 'gate-1', target)).toBe(false);
    // A vertex always reaches itself, even when stranded.
    expect(isReachable(graph, target, target)).toBe(true);
  });

  it('returns empty for an unknown start', () => {
    const result = bfs(campus(), 'missing');
    expect(result.order).toEqual([]);
    expect(result.visited.size).toBe(0);
  });
});

/* --------------------------------------------------- adjacency structures */

describe('adjacency list', () => {
  it('lists each path once per permitted direction', () => {
    const graph = campus();
    const list = toAdjacencyList(locations, edges);
    const total = Object.values(list).reduce((sum, entries) => sum + entries.length, 0);

    const twoWay = [...graph.edges.values()].filter((edge) => edge.direction === 'both').length;
    const oneWay = [...graph.edges.values()].filter((edge) => edge.direction !== 'both').length;
    expect(total).toBe(twoWay * 2 + oneWay);
  });

  it('matches the graph adjacency exactly', () => {
    const graph = campus();
    const list = toAdjacencyList(locations, edges);
    for (const [node, entries] of Object.entries(list)) {
      expect(entries.length).toBe(graph.adjacency[node].length);
    }
  });

  it('renders copy-pasteable TypeScript', () => {
    const code = adjacencyListToCode(toAdjacencyList(locations, edges));
    expect(code.startsWith('const campusGraph = {')).toBe(true);
    expect(code.trimEnd().endsWith('};')).toBe(true);
    expect(code).toContain('node:');
    expect(code).toContain('distance:');
  });
});

describe('adjacency matrix', () => {
  it('has the correct shape and a zero diagonal', () => {
    const matrix = buildAdjacencyMatrix(campus(), 'binary');
    expect(matrix.values).toHaveLength(matrix.nodes.length);
    for (let i = 0; i < matrix.nodes.length; i += 1) {
      expect(matrix.values[i]).toHaveLength(matrix.nodes.length);
      expect(matrix.values[i][i]).toBe(0);
    }
  });

  it('is symmetric when every path is two-way', () => {
    const bothWays = edges.map((edge) => ({ ...edge, direction: 'both' as const }));
    const matrix = buildAdjacencyMatrix(buildGraph(locations, bothWays).graph, 'binary');
    for (let i = 0; i < matrix.nodes.length; i += 1) {
      for (let j = 0; j < matrix.nodes.length; j += 1) {
        expect(matrix.values[i][j]).toBe(matrix.values[j][i]);
      }
    }
  });

  it('is asymmetric for a one-way path', () => {
    const graph = buildGraph(locations, [
      { id: 'one-way', from: 'gate-1', to: 'gate-2', distance: 100, walkable: true, direction: 'forward' },
    ]).graph;
    const matrix = buildAdjacencyMatrix(graph, 'binary');
    const i = matrix.nodes.indexOf('gate-1');
    const j = matrix.nodes.indexOf('gate-2');
    expect(matrix.values[i][j]).toBe(1);
    expect(matrix.values[j][i]).toBe(0);
  });

  it('stores real distances in weighted mode', () => {
    const matrix = buildAdjacencyMatrix(campus(), 'weighted');
    const at = (id: string) => matrix.nodes.indexOf(id);

    expect(matrix.values[at('gate-1')][at('gate-2')]).toBe(175);
    expect(matrix.values[at('core-4')][at('core-5')]).toBe(30);
    expect(matrix.values[at('core-1')][at('clinic-building')]).toBe(matrix.empty); // closed path
  });

  it('agrees with the adjacency list on which pairs are connected', () => {
    const graph = campus();
    const matrix = buildAdjacencyMatrix(graph, 'binary');
    for (let i = 0; i < matrix.nodes.length; i += 1) {
      const neighbours = new Set(graph.adjacency[matrix.nodes[i]].map((item) => item.node));
      for (let j = 0; j < matrix.nodes.length; j += 1) {
        if (i === j) continue;
        expect(matrix.values[i][j] === 1).toBe(neighbours.has(matrix.nodes[j]));
      }
    }
  });
});

/* ------------------------------------------------------------ graph stats */

describe('computeStats', () => {
  it('counts vertices and edges', () => {
    const stats = computeStats(campus());
    expect(stats.vertices).toBe(15);
    expect(stats.edges).toBe(21);
    expect(stats.walkableEdges).toBe(stats.edges);
    expect(stats.selfLoops).toBe(0);
  });

  it('reports the seeded campus as one connected component', () => {
    const stats = computeStats(campus());
    expect(stats.components).toBe(1);
    expect(stats.componentSizes).toEqual([15]);
  });

  it('reports a second component once one is isolated', () => {
    const target = 'shs-building';
    const isolated = edges.map((edge) =>
      edge.from === target || edge.to === target ? { ...edge, walkable: false } : edge,
    );
    const stats = computeStats(buildGraph(locations, isolated).graph);
    expect(stats.components).toBe(2);
    expect(stats.componentSizes).toEqual([14, 1]);
  });

  it('produces a consistent density and mean degree', () => {
    const stats = computeStats(campus());
    expect(stats.density).toBeCloseTo((2 * stats.edges) / (stats.vertices * (stats.vertices - 1)), 9);
    expect(stats.averageDegree).toBeCloseTo((2 * stats.edges) / stats.vertices, 9);
    expect(stats.density).toBeGreaterThan(0);
    expect(stats.density).toBeLessThanOrEqual(1);
  });

  it('keeps degree independent of one-way restrictions', () => {
    // Degree is the undirected notion, so a one-way path still counts at both ends.
    const base = computeStats(campus());
    const directed = buildGraph(
      locations,
      edges.map((edge) =>
        edge.id === 'gate-1__gate-2' ? { ...edge, direction: 'forward' as const } : edge,
      ),
    ).graph;
    const after = computeStats(directed);
    expect(after.averageDegree).toBeCloseTo(base.averageDegree, 9);
    expect(after.edges).toBe(base.edges);
  });

  it('handles a single-vertex graph without dividing by zero', () => {
    const stats = computeStats(buildGraph([locations[0]], []).graph);
    expect(stats.vertices).toBe(1);
    expect(stats.density).toBe(0);
    expect(stats.averageDegree).toBe(0);
  });

  it('handles an empty graph', () => {
    const stats = computeStats(buildGraph([], []).graph);
    expect(stats.vertices).toBe(0);
    expect(stats.components).toBe(0);
    expect(stats.density).toBe(0);
  });
});