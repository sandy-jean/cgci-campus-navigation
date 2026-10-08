/**
 * Admin: overview.
 *
 * Surfaces graph health at a glance and, importantly, the provenance status of the
 * campus data. The provisional-data call to action is the first thing on the page
 * because it is the one action the project genuinely needs from an administrator
 * before the dataset may be presented as official CGCI information.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Database, GitBranch, Info, Layers, Route } from 'lucide-react';

import { computeStats } from '@/algorithms/graph';
import { unreachableFrom } from '@/algorithms/bfs';
import { Badge, Card, ErrorState, SectionHeading, SkeletonCard } from '@/components/ui';
import { EVENT_DOCUMENTATION } from '@/services/analytics';
import { useCampusData } from '@/context/CampusDataContext';

export function AdminOverviewPage() {
  const { graph, locations, edges, status, error, warnings, hasProvisionalData } = useCampusData();

  const stats = useMemo(() => computeStats(graph), [graph]);
  const stranded = useMemo(
    () => (graph.nodes.length > 0 ? unreachableFrom(graph, graph.nodes[0]) : []),
    [graph],
  );
  const verifiedCount = locations.filter((location) => location.verified).length;
  const inactiveCount = locations.filter((location) => !location.isActive).length;
  const closedPaths = edges.filter((edge) => !edge.walkable).length;

  if (status === 'initialising' || status === 'loading') {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState title="Campus data could not be loaded" message={error ?? 'Unknown error.'} />;
  }

  return (
    <div className="space-y-6">
      {hasProvisionalData && (
        <div className="rounded-lg border border-route-100 bg-route-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-route-600" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-semibold text-ink-900">
                Campus data needs review
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                {verifiedCount} of {locations.length} locations have been confirmed
                against official campus information. The rest carry placeholder names,
                facilities and hours taken from the project brief and must not be
                presented as official CGCI data until they are checked.
              </p>
              <Link
                to="/admin/locations"
                className="mt-3 inline-block rounded-md bg-ink-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-ink-800"
              >
                Review locations
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Layers size={18} aria-hidden="true" />}
          label="Vertices (V)"
          value={stats.vertices}
          hint={`${locations.length} stored · ${inactiveCount} inactive`}
        />
        <MetricCard
          icon={<GitBranch size={18} aria-hidden="true" />}
          label="Edges (E)"
          value={stats.edges}
          hint={`${closedPaths} closed · ${stats.walkableEdges} open`}
        />
        <MetricCard
          icon={<Database size={18} aria-hidden="true" />}
          label="Components"
          value={stats.components}
          hint={`largest has ${stats.componentSizes[0] ?? 0} vertices`}
        />
        <MetricCard
          icon={<Route size={18} aria-hidden="true" />}
          label="Mean degree"
          value={stats.averageDegree.toFixed(2)}
          hint={`density ${stats.density.toFixed(3)}`}
        />
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Graph health"
          description="Problems worth fixing before the dataset is treated as final."
        />

        <ul className="space-y-2.5 text-sm">
          <HealthRow
            ok={warnings.length === 0}
            okText="Every stored path is valid, connected and correctly weighted."
            badText={`${warnings.length} issue(s) found while assembling the graph, such as a path with an unknown endpoint or an invalid distance. Expand “Data warnings” on the Navigate page for the detail.`}
            label="Path integrity"
          />
          {/*
            A closed path is a deliberate operational state, not a data fault, so it
            is reported separately from integrity problems. Reopening one changes
            the shortest route, which is exactly what the demo closed path exists to
            show.
          */}
          {closedPaths > 0 && (
            <li className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                <Info size={17} className="text-ink-400" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-ink-900">
                  Closed paths <Badge tone="neutral" className="ml-1">{closedPaths}</Badge>
                </p>
                <p className="mt-0.5 text-ink-600">
                  Excluded from routing and drawn as a dashed line on the map.
                  Reopening one from{' '}
                  <Link to="/admin/paths" className="underline underline-offset-2">
                    Paths
                  </Link>{' '}
                  changes the shortest route.
                </p>
              </div>
            </li>
          )}
          <HealthRow
            ok={stats.components === 1 || stats.vertices === 0}
            okText="All buildings sit in one connected component, so every pair can be routed."
            badText={`The graph has ${stats.components} components. ${stranded.length} building(s) are unreachable from ${graph.locations.get(graph.nodes[0])?.name ?? 'the first vertex'}: ${stranded
              .map((id) => graph.locations.get(id)?.name ?? id)
              .join(', ')}.`}
            label="Connectivity"
          />
          <HealthRow
            ok={stats.selfLoops === 0}
            okText="No self-loops. Every path joins two different buildings."
            badText={`${stats.selfLoops} self-loop(s) found. A path cannot join a building to itself.`}
            label="Self-loops"
          />
          <HealthRow
            ok={locations.length > 0}
            okText={`${locations.length} active locations are available for routing.`}
            badText="There are no active locations, so no route can be calculated."
            label="Vertex count"
          />
        </ul>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="Measured analytics events"
          description="What the system reports to Firebase Analytics. No personal data is collected: locations are referenced by document id, never by name, and no email address is ever sent."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold text-ink-800">Event</th>
                <th scope="col" className="py-2 font-semibold text-ink-800">Recorded when</th>
              </tr>
            </thead>
            <tbody className="text-ink-700">
              {EVENT_DOCUMENTATION.map((event) => (
                <tr key={event.name} className="border-b border-ink-100 last:border-0">
                  <td className="py-2 pr-4 align-top">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">{event.name}</code>
                  </td>
                  <td className="py-2 align-top">{event.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Live event counts are visible in the Firebase console under Analytics →
          Events. They are not mirrored here, because pulling them back would require
          a server-side credential that must never be present in a browser bundle.
        </p>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-500">
        <span className="text-cgci-700">{icon}</span>
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink-900 tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink-500">{hint}</p>
    </Card>
  );
}

function HealthRow({
  ok,
  okText,
  badText,
  label,
}: {
  ok: boolean;
  okText: string;
  badText: string;
  label: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        {ok ? (
          <CheckCircle2 size={17} className="text-cgci-600" aria-hidden="true" />
        ) : (
          <AlertTriangle size={17} className="text-route-600" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-ink-900">
          {label}{' '}
          <Badge tone={ok ? 'green' : 'amber'} className="ml-1">
            {ok ? 'OK' : 'Check'}
          </Badge>
        </p>
        <p className="mt-0.5 text-ink-600">{ok ? okText : badText}</p>
      </div>
    </li>
  );
}