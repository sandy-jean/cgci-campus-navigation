import dataset from '../src/data/campusLayout.json';
import { buildGraph, computeStats } from '../src/algorithms/graph';
import { dijkstra } from '../src/algorithms/dijkstra';
import { bfs } from '../src/algorithms/bfs';
import { buildAdjacencyMatrix, matrixToMarkdown } from '../src/algorithms/adjacencyMatrix';
import { adjacencyListToCode, toAdjacencyList } from '../src/algorithms/adjacencyList';
import { writeFileSync } from 'node:fs';

const locations = dataset.locations as any;
const edges = dataset.edges as any;
const { graph, warnings } = buildGraph(locations, edges);
const name = (id: string) => graph.locations.get(id)?.name ?? id;
const s = computeStats(graph);

const bfsFrom = (start: string) => bfs(graph, start);
const matrix = buildAdjacencyMatrix(graph, 'binary');
const matrixMd = matrixToMarkdown(matrix, graph.nodes);

const payload = {
  stats: {
    vertices: s.vertices,
    edgesStored: edges.length,
    edgesOpen: s.edges,
    edgesClosed: edges.length - s.edges,
    components: s.components,
    density: s.density,
    averageDegree: s.averageDegree,
    selfLoops: s.selfLoops,
  },
  locations: graph.nodes.map((id) => {
    const l = graph.locations.get(id)!;
    return {
      id, name: l.name, type: l.type, category: l.category, footprint: l.footprint ?? 'building',
      verified: l.verified === true, facilities: l.facilities ?? [], keywords: l.keywords ?? [],
      x: l.x, y: l.y,
    };
  }),
  paths: [...graph.edges.values()]
    .map(e => ({ from: name(e.from), to: name(e.to), distance: e.distance, walkable: e.walkable, direction: e.direction }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.distance - b.distance),
  closedPaths: edges.filter(e => !e.walkable).map(e => ({ from: name(e.from), to: name(e.to), distance: e.distance, note: e.note })),
  examples: [
    ['gate-1', 'shs-building'],
    ['core-1', 'parking-area'],
    ['gate-1', 'core-1'],
    ['gate-2', 'clinic-building'],
    ['core-4', 'core-3'],
    ['core-2', 'shs-ground'],
  ].map(([a, b]) => {
    const r = dijkstra(graph, a, b);
    return { from: name(a), to: name(b), reachable: r.reachable, distance: r.distance, path: r.path.map(name), relaxations: r.relaxations, hops: r.path.length - 1, walkMinutes: Math.max(1, Math.round(r.distance / 78)) };
  }),
  reopened: (() => {
    const g = buildGraph(locations, edges.map((e: any) => (e.id === 'core-1__clinic-building' ? { ...e, walkable: true } : e))).graph;
    const r = dijkstra(g, 'core-1', 'parking-area');
    return { distance: r.distance, path: r.path.map(name) };
  })(),
  bfs: (() => {
    const r = bfsFrom('gate-1');
    // id and display name travel together: the hop counts are keyed by id.
    return { start: name('gate-1'), order: r.order.map((id) => ({ id, name: name(id), hops: r.hops[id] })) };
  })(),
  adjacencyList: adjacencyListToCode(toAdjacencyList(locations, edges)),
  matrixMarkdown: matrixMd,
  warnings,
};

writeFileSync(new URL('../docs/figures.json', import.meta.url), JSON.stringify(payload, null, 2), 'utf8');
console.log('wrote docs/figures.json');
console.log(`V=${s.vertices} E=${s.edges}/${edges.length} components=${s.components} density=${s.density.toFixed(4)} avgdeg=${s.averageDegree.toFixed(4)}`);
for (const e of payload.examples) console.log(`  ${e.from} -> ${e.to}: ${e.distance}m, ${e.hops} hops, ${e.path.join(' > ')}`);
console.log(`  reopened CORE 1 -> Central Parking: ${payload.reopened.distance}m via ${payload.reopened.path.join(' > ')}`);
console.log(`  warnings: ${warnings.length}`);