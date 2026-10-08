/**
 * Discrete Structures reference page.
 *
 * Every figure on this page is computed from the live campus graph rather than
 * hard-coded. When an administrator adds a building or reopens a path in Firestore,
 * the vertex count, the adjacency list, the matrix, the BFS order and the Dijkstra
 * trace all change together. That is deliberate: the page is meant to be shown
 * during a defence, and a hard-coded example would stop matching the live map the
 * moment anyone edited anything.
 */

import { useMemo, useState } from 'react';
import { BookOpen, Copy, Check, Network, Sigma, Waypoints, Zap } from 'lucide-react';

import { bfs, isReachable } from '@/algorithms/bfs';
import { buildAdjacencyMatrix, matrixToMarkdown, type MatrixMode } from '@/algorithms/adjacencyMatrix';
import { adjacencyListToCode, toAdjacencyList } from '@/algorithms/adjacencyList';
import { computeStats, edgeCount, vertexCount } from '@/algorithms/graph';
import { dijkstra } from '@/algorithms/dijkstra';
import { Badge, Card, SectionHeading } from '@/components/ui';
import { SelectField } from '@/components/ui/forms';
import { useCampusData } from '@/context/CampusDataContext';
import { formatDistance } from '@/utils/format';

/** An inline code sample with a copy button. */
function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard can be blocked; the code is still selectable on screen. */
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-ink-300 transition hover:bg-ink-800 hover:text-white"
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto px-4 py-3 text-xs leading-relaxed text-ink-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DiscreteStructuresPage() {
  const { graph, status } = useCampusData();

  const [mode, setMode] = useState<MatrixMode>('binary');
  const [startId, setStartId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');

  const nodes = graph.nodes;
  const locations = useMemo(() => nodes.map((id) => graph.locations.get(id)!), [graph, nodes]);

  // Default the playground to the first two buildings once data has loaded.
  const start = startId || nodes[0] || '';
  const target = targetId || nodes[1] || '';

  const matrix = useMemo(() => buildAdjacencyMatrix(graph, mode), [graph, mode]);
  const list = useMemo(
    () => toAdjacencyList(locations, [...graph.edges.values()]),
    [locations, graph],
  );
  const listCode = useMemo(() => adjacencyListToCode(list), [list]);
  const matrixMarkdown = useMemo(
    () => matrixToMarkdown(matrix, nodes),
    [matrix, nodes],
  );

  const stats = useMemo(() => computeStats(graph), [graph]);
  const bfsResult = useMemo(() => (start ? bfs(graph, start) : null), [graph, start]);
  const path = useMemo(
    () => (start && target ? dijkstra(graph, start, target) : null),
    [graph, start, target],
  );
  const reachable = start && target ? isReachable(graph, start, target) : false;

  const nameOf = (id: string) => graph.locations.get(id)?.name ?? id;

  if (status !== 'ready') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-ink-600">
        Loading the campus graph…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-medium text-cgci-700">
          <BookOpen size={16} aria-hidden="true" />
          Discrete Structures 1 · Project Reference
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">
          How the campus navigation system is built
        </h1>
        <p className="mt-2 max-w-3xl text-ink-700">
          The campus is treated as a graph. This page shows the actual graph the
          application is running on — the vertex set, the edge set, both adjacency
          representations, and the reachability and shortest-path results — so every
          claim in the report can be checked against the live system.
        </p>
      </header>

      {/* -------------------------------- 1. G = (V,E) -------------------------------- */}
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="1. The campus as a graph, G = (V, E)"
          description="A graph is an ordered pair of a vertex set and an edge set."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-cgci-200 bg-cgci-50 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-cgci-900">
              <Network size={16} aria-hidden="true" />
              V — the vertex set
            </h3>
            <p className="mt-1 text-sm text-cgci-900/80">
              Every campus location is one vertex, stored as a document in the{' '}
              <code className="rounded bg-white px-1">locations</code> collection.
            </p>
            <p className="mt-3 text-3xl font-semibold text-cgci-800 tabular-nums">
              |V| = {vertexCount(graph)}
            </p>
            <p className="mt-2 text-xs text-cgci-900/70">
              {locations.map((location) => location.name).join(', ')}
            </p>
          </div>

          <div className="rounded-lg border border-route-100 bg-route-50 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-route-600">
              <Waypoints size={16} aria-hidden="true" />
              E — the edge set
            </h3>
            <p className="mt-1 text-sm text-ink-700">
              Every walkable path is one edge, stored in the{' '}
              <code className="rounded bg-white px-1">edges</code> collection and
              weighted by its length in metres.
            </p>
            <p className="mt-3 text-3xl font-semibold text-route-600 tabular-nums">
              |E| = {edgeCount(graph)}
            </p>
            <p className="mt-2 text-xs text-ink-600">
              Undirected by default; an edge may be restricted to one direction.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-200 pt-5 sm:grid-cols-4">
          <Stat label="Vertices |V|" value={String(stats.vertices)} />
          <Stat label="Edges |E|" value={String(stats.edges)} />
          <Stat label="Connected components" value={String(stats.components)} />
          <Stat label="Graph density" value={stats.density.toFixed(3)} />
        </dl>

        {stats.components > 1 && (
          <p className="mt-3 rounded-md border border-route-100 bg-route-50 px-3 py-2 text-sm text-ink-700">
            The graph has <strong>{stats.components} connected components</strong> of
            sizes {stats.componentSizes.join(', ')}. A vertex in one component can never
            reach a vertex in another, which is exactly why some routes are refused.
          </p>
        )}
      </Card>

      {/* -------------------------------- 2. Adjacency list -------------------------------- */}
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="2. Adjacency list"
          description="The representation the algorithms actually traverse."
        />
        <p className="mb-4 max-w-3xl text-sm text-ink-700">
          Each vertex maps to the vertices one step away, with the weight of the
          connecting edge. Storage is O(|V| + |E|), which suits a sparse campus graph;
          this is the list that Dijkstra and BFS walk. It is generated from the
          Firestore <code>edges</code> collection on every load, never hard-coded.
        </p>
        <CodeBlock code={listCode} label="campusGraph — generated adjacency list" />
      </Card>

      {/* -------------------------------- 3. Adjacency matrix -------------------------------- */}
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="3. Adjacency matrix"
          description="The classic |V| × |V| table, useful for reasoning about the graph by hand."
          action={
            <div className="w-44">
              <SelectField
                label="Display"
                value={mode}
                onChange={(event) => setMode(event.target.value as MatrixMode)}
                options={[
                  { value: 'binary', label: 'Binary (1 / 0)' },
                  { value: 'weighted', label: 'Weighted (metres)' },
                ]}
              />
            </div>
          }
        />
        <p className="mb-4 max-w-3xl text-sm text-ink-700">
          Row <em>i</em>, column <em>j</em> is the weight of travelling from vertex{' '}
          <em>i</em> to vertex <em>j</em>. In binary mode a cell is 1 when an edge
          exists and 0 otherwise, with a zero diagonal because there are no
          self-loops. In weighted mode the cell holds the distance in metres. The
          matrix costs O(|V|²) memory — quadratic — which is precisely why routing uses
          the adjacency list instead.
        </p>

        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="min-w-full border-collapse text-xs">
            <caption className="sr-only">
              Campus graph adjacency matrix, {mode === 'binary' ? 'binary' : 'weighted in metres'}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-ink-50 px-3 py-2 text-left font-semibold text-ink-700">
                  from \ to
                </th>
                {matrix.nodes.map((id, index) => (
                  <th
                    key={id}
                    scope="col"
                    className="px-2 py-2 text-center font-medium text-ink-600"
                    title={nameOf(id)}
                  >
                    <span className="block max-w-[4.5rem] truncate">{shortLabel(nameOf(id))}</span>
                    <span className="block text-[10px] text-ink-400">v{index}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.nodes.map((rowId, rowIndex) => (
                <tr key={rowId} className="border-t border-ink-200">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-ink-50 px-3 py-2 text-left font-medium text-ink-800"
                    title={nameOf(rowId)}
                  >
                    <span className="block max-w-[7rem] truncate">{shortLabel(nameOf(rowId))}</span>
                    <span className="block text-[10px] text-ink-400">v{rowIndex}</span>
                  </th>
                  {matrix.values[rowIndex].map((value, columnIndex) => {
                    const empty = value === matrix.empty || (matrix.mode === 'weighted' && value === 0 && rowIndex === columnIndex);
                    const diagonal = rowIndex === columnIndex;
                    return (
                      <td
                        key={columnIndex}
                        className={`px-2 py-2 text-center tabular-nums ${
                          diagonal
                            ? 'bg-ink-100 text-ink-400'
                            : empty
                              ? 'bg-ink-50/60 text-ink-300'
                              : value === 1 && matrix.mode === 'binary'
                                ? 'bg-cgci-600 font-semibold text-white'
                                : 'bg-cgci-50 font-medium text-cgci-900'
                        }`}
                      >
                        {diagonal ? '0' : empty ? '·' : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-ink-500">
          A dash means no edge. The diagonal is fixed at zero. Values are symmetric for
          every two-way path; a one-way path produces an asymmetric pair, which is how
          a directed restriction becomes visible in the matrix.
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-cgci-700">
            Show this matrix as a markdown table (for the report)
          </summary>
          <div className="mt-2">
            <CodeBlock code={matrixMarkdown} label="adjacency matrix — markdown" />
          </div>
        </details>
      </Card>

      {/* -------------------------------- 4. Playground -------------------------------- */}
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="3. Try it: reachability, BFS and Dijkstra on the live graph"
          description="Pick any two buildings and the results below update from the real campus data."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="From"
            value={start}
            onChange={(event) => setStartId(event.target.value)}
            options={nodes.map((id) => ({ value: id, label: nameOf(id) }))}
          />
          <SelectField
            label="To"
            value={target}
            onChange={(event) => setTargetId(event.target.value)}
            options={nodes.map((id) => ({ value: id, label: nameOf(id) }))}
          />
        </div>

        {/* Reachability */}
        <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-ink-900">
            <Sigma size={16} aria-hidden="true" />
            Reachability
          </h3>
          <p className="mt-2 text-sm text-ink-700">
            Is <strong>{nameOf(target)}</strong> reachable from{' '}
            <strong>{nameOf(start)}</strong>?
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {reachable ? (
              <span className="text-cgci-700">TRUE</span>
            ) : (
              <span className="text-red-700">FALSE — destination cannot be reached</span>
            )}
          </p>
          <p className="mt-2 text-xs text-ink-600">
            Reachability is tested with BFS. It ignores distances — a vertex is
            reachable if any sequence of open paths leads to it, however long the
            walk.
          </p>
        </div>

        {/* BFS order */}
        <div className="mt-4 rounded-lg border border-ink-200 p-4">
          <h3 className="font-semibold text-ink-900">Breadth-first search order</h3>
          <p className="mt-1 text-sm text-ink-600">
            Vertices in the order BFS settles them from{' '}
            <strong>{nameOf(start)}</strong>, with the number of edges crossed in
            brackets.
          </p>
          {bfsResult && bfsResult.order.length > 0 ? (
            <ol className="mt-3 flex flex-wrap gap-1.5">
              {bfsResult.order.map((id, index) => (
                <li
                  key={id}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    index === 0
                      ? 'border-cgci-600 bg-cgci-700 text-white'
                      : 'border-ink-300 bg-white text-ink-800'
                  }`}
                >
                  {nameOf(id)}{' '}
                  <span className="tabular-nums opacity-70">({bfsResult.hops[id]})</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-500">No starting point selected.</p>
          )}
          <p className="mt-3 text-xs text-ink-600">
            BFS explores in layers of <em>edges</em>, so vertices at the same bracket
            are the same number of steps away. That is why BFS answers reachability
            but not routing.
          </p>
        </div>

        {/* Dijkstra trace */}
        <div className="mt-4 rounded-lg border border-ink-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-ink-900">
            <Zap size={16} aria-hidden="true" />
            Dijkstra trace
          </h3>
          {path?.reachable ? (
            <>
              <p className="mt-1 text-sm text-ink-600">
                Dijkstra settles each vertex once, always taking the nearest unsettled
                one. This was the order it finalised distances, then the route it
                rebuilt from the predecessor chain.
              </p>

              <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                {path.visitOrder.map((id, index) => (
                  <li key={`${id}-${index}`} className="flex items-center gap-1.5">
                    <span
                      className={`rounded border px-2 py-1 text-xs font-medium ${
                        id === target
                          ? 'border-route-400 bg-route-100 text-route-600'
                          : 'border-ink-300 bg-white text-ink-800'
                      }`}
                    >
                      {nameOf(id)}
                    </span>
                    {index < path.visitOrder.length - 1 && (
                      <span aria-hidden="true" className="text-ink-300">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>

              <div className="mt-4 rounded-md bg-cgci-50 p-3">
                <p className="text-xs font-semibold tracking-wide text-cgci-800 uppercase">
                  Shortest path
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-cgci-900">
                  {path.path.map((id, index) => (
                    <span key={`${id}-${index}`} className="flex items-center gap-1.5">
                      {index > 0 && (
                        <span aria-hidden="true" className="text-cgci-400">
                          ↓
                        </span>
                      )}
                      {nameOf(id)}
                    </span>
                  ))}
                </p>
                <p className="mt-2 text-sm text-cgci-800">
                  Total distance: <strong>{formatDistance(path.distance)}</strong> ·{' '}
                  {path.path.length - 1} segments · {path.relaxations} relaxations
                </p>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-cgci-700">
                  Why not just use BFS for routing?
                </summary>
                <p className="mt-2 text-sm text-ink-700">
                  BFS minimises the number of edges crossed, not the metres walked. On
                  this graph, BFS from <strong>{nameOf(start)}</strong> reaches{' '}
                  {bfsResult?.order.length ?? 0} vertices in at most{' '}
                  {Math.max(...Object.values(bfsResult?.hops ?? { 0: 0 }))} steps, but the
                  route it prefers is not always the shortest walk. Dijkstra minimises
                  total weight, which is what someone trying to get somewhere actually
                  cares about.
                </p>
              </details>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-600">
              No path exists between these two locations on the paths currently open.
              BFS reports the destination as unreachable, so Dijkstra has nothing to
              reconstruct.
            </p>
          )}
        </div>
      </Card>

      {/* -------------------------------- 5. Complexity -------------------------------- */}
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="4. Complexity and the limits of this approach"
          description="Why the system is fast enough, and where it would stop being fast enough."
        />

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold text-ink-800">
                  Algorithm
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold text-ink-800">
                  Time
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold text-ink-800">
                  Space
                </th>
                <th scope="col" className="py-2 font-semibold text-ink-800">
                  Used here for
                </th>
              </tr>
            </thead>
            <tbody className="text-ink-700">
              <tr className="border-b border-ink-100">
                <td className="py-2 pr-4 font-mono text-xs">Dijkstra (binary heap)</td>
                <td className="py-2 pr-4 font-mono text-xs">O((V + E) log V)</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V)</td>
                <td className="py-2">Shortest walking route</td>
              </tr>
              <tr className="border-b border-ink-100">
                <td className="py-2 pr-4 font-mono text-xs">BFS</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V + E)</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V)</td>
                <td className="py-2">Reachability, components</td>
              </tr>
              <tr className="border-b border-ink-100">
                <td className="py-2 pr-4 font-mono text-xs">Adjacency list build</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V + E)</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V + E)</td>
                <td className="py-2">The traversal structure</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">Adjacency matrix build</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V²)</td>
                <td className="py-2 pr-4 font-mono text-xs">O(V²)</td>
                <td className="py-2">Display and explanation only</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-200 p-4">
            <h3 className="font-semibold text-ink-900">Why Dijkstra applies</h3>
            <p className="mt-1.5 text-sm text-ink-700">
              Dijkstra requires every edge weight to be non-negative. A walking path
              cannot have a negative length, so the condition always holds. The greedy
              step — finalising the nearest unsettled vertex — is therefore safe: no
              later path can ever reach that vertex more cheaply.
            </p>
          </div>
          <div className="rounded-lg border border-ink-200 p-4">
            <h3 className="font-semibold text-ink-900">Where this stops working</h3>
            <p className="mt-1.5 text-sm text-ink-700">
              Dijkstra solves one source to every vertex. For true all-pairs shortest
              paths, Floyd–Warshall costs O(V³) and becomes impractical somewhere in
              the thousands of vertices. A large campus would instead run Dijkstra once
              per building and cache the distance table. Because the campus graph is
              loaded once and reused, this system already does the easy half of that:
              the structure is built a single time per data change.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 px-4 py-3 text-sm">
          <Badge tone="green">Live</Badge>
          <span className="text-ink-700">
            Every number on this page was computed from the current Firestore data at
            the moment it loaded.
          </span>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}

/** Shortens a label so the matrix header stays narrow. */
function shortLabel(label: string): string {
  const words = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  return words.length > 2 ? `${words[0]} ${words[1]}` : words.join(' ');
}