/**
 * Admin: graph inspector.
 *
 * The structural view of the live campus graph: a visual map of the walkways, the
 * adjacency list, the adjacency matrix, and the distance table. Everything is
 * generated from the same graph instance the navigation page routes with, so the
 * numbers here are the numbers the algorithm actually used.
 */

import { useMemo, useState } from 'react';
import { Copy, Check, Network } from 'lucide-react';

import { adjacencyListToCode, toAdjacencyList } from '@/algorithms/adjacencyList';
import { buildAdjacencyMatrix, type MatrixMode } from '@/algorithms/adjacencyMatrix';
import { computeStats } from '@/algorithms/graph';
import { dijkstraFromSource } from '@/algorithms/dijkstra';
import { Button, Card, ErrorState, SectionHeading, SkeletonCard } from '@/components/ui';
import { SelectField } from '@/components/ui/forms';
import { CampusMap } from '@/components/map/CampusMap';
import { useCampusData } from '@/context/CampusDataContext';
import { formatDistance } from '@/utils/format';

export function AdminGraphPage() {
  const { graph, status, error } = useCampusData();
  const [mode, setMode] = useState<MatrixMode>('binary');
  const [sourceId, setSourceId] = useState('');

  const matrix = useMemo(() => buildAdjacencyMatrix(graph, mode), [graph, mode]);
  const listCode = useMemo(
    () => adjacencyListToCode(toAdjacencyList([...graph.locations.values()], [...graph.edges.values()])),
    [graph],
  );
  const stats = useMemo(() => computeStats(graph), [graph]);
  const distances = useMemo(
    () => (sourceId ? dijkstraFromSource(graph, sourceId) : null),
    [graph, sourceId],
  );

  const nameOf = (id: string) => graph.locations.get(id)?.name ?? id;

  if (status === 'initialising' || status === 'loading') return <SkeletonCard />;
  if (status === 'error') return <ErrorState message={error ?? 'Unknown error.'} />;

  const maxDistance = distances
    ? Math.max(...Object.values(distances).filter(Number.isFinite), 0)
    : 0;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Graph inspector"
        description="Both adjacency representations, generated from the campus data currently in Firestore."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="|V| vertices" value={stats.vertices} />
        <Metric label="|E| edges" value={stats.edges} />
        <Metric label="Components" value={stats.components} hint={stats.componentSizes.join(' / ')} />
        <Metric label="Mean degree" value={stats.averageDegree.toFixed(2)} hint={`density ${stats.density.toFixed(3)}`} />
      </div>

      {/* Live map of the walkways */}
      <Card className="overflow-hidden">
        <div className="border-b border-ink-200 px-4 py-3">
          <h2 className="text-base font-semibold text-ink-900">Walkway map</h2>
          <p className="text-sm text-ink-600">
            Dashed grey lines are closed paths, excluded from routing until reopened.
          </p>
        </div>
        <div className="h-[380px] sm:h-[460px]">
          <CampusMap
            graph={graph}
            result={null}
            originId={null}
            destinationId={null}
            selectedId={null}
            focusId={null}
            animationKey="admin"
            onSelect={() => undefined}
            onFocusChange={() => undefined}
          />
        </div>
      </Card>

      {/* Adjacency list */}
      <Card className="p-5">
        <SectionHeading
          title="Adjacency list"
          description="Vertex → the vertices one step away, with the connecting weight."
        />
        <CopyBlock code={listCode} label="generated from the edges collection" />
      </Card>

      {/* Adjacency matrix */}
      <Card className="p-5">
        <SectionHeading
          title="Adjacency matrix"
          description="Rows are sources, columns are destinations."
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
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-50 px-3 py-2 text-left font-semibold text-ink-700">
                  from \ to
                </th>
                {matrix.nodes.map((id) => (
                  <th key={id} scope="col" className="px-2 py-2 font-medium text-ink-600" title={nameOf(id)}>
                    <span className="block max-w-[5rem] truncate">{nameOf(id)}</span>
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
                    <span className="block max-w-[7rem] truncate">{nameOf(rowId)}</span>
                  </th>
                  {matrix.values[rowIndex].map((value, columnIndex) => {
                    const empty =
                      value === matrix.empty || (matrix.mode === 'weighted' && rowIndex === columnIndex && value === 0);
                    return (
                      <td
                        key={columnIndex}
                        className={`px-2 py-1.5 text-center tabular-nums ${
                          rowIndex === columnIndex
                            ? 'bg-ink-100 text-ink-400'
                            : empty
                              ? 'bg-ink-50/60 text-ink-300'
                              : mode === 'binary'
                                ? 'bg-cgci-600 font-semibold text-white'
                                : 'bg-cgci-50 font-medium text-cgci-900'
                        }`}
                      >
                        {rowIndex === columnIndex ? '0' : empty ? '·' : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Distance table */}
      <Card className="p-5">
        <SectionHeading
          title="Shortest distance from one building"
          description="A single Dijkstra run settles every vertex, so one pass yields the whole distance table."
        />
        <div className="max-w-xs">
          <SelectField
            label="From"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            placeholder="Select a building"
            options={graph.nodes.map((id) => ({ value: id, label: nameOf(id) }))}
          />
        </div>

        {distances && (
          <div className="mt-4 space-y-2">
            {graph.nodes.map((id) => {
              const distance = distances[id];
              const unreachable = distance === undefined;
              const width = unreachable || maxDistance === 0 ? 0 : (distance / maxDistance) * 100;
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-ink-700 sm:w-52">{nameOf(id)}</span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-cgci-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-ink-900">
                    {unreachable ? '—' : formatDistance(distance)}
                  </span>
                </div>
              );
            })}
            {Object.keys(distances).length !== graph.nodes.length && (
              <p className="pt-1 text-xs text-ink-500">
                Dashed rows are unreachable from this building. They are in a different
                connected component, so no sequence of open paths reaches them.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
        <Network size={14} className="text-cgci-700" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* Clipboard can be blocked by the browser. */
            }
          }}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto px-4 py-3 text-xs leading-relaxed text-ink-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}