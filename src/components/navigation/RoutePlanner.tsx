/**
 * The route planning controls: choose a start, choose a destination, calculate.
 *
 * The submit button stays disabled until both endpoints are chosen, and the
 * disabled reason is stated in text underneath rather than left for the visitor to
 * guess. Calculation itself is delegated entirely to the algorithms module.
 */

import { useState } from 'react';
import { ArrowDownUp, LocateFixed, Route as RouteIcon } from 'lucide-react';

import type { CampusGraph } from '@/algorithms/graph';
import type { CampusLocation, PathResult } from '@/types/campus';
import { formatDistance, formatDuration, walkingMinutes } from '@/utils/format';
import { Button, Card } from '@/components/ui';
import { SelectField, type SelectOption } from '@/components/ui/forms';

interface RoutePlannerPanelProps {
  locations: CampusLocation[];
  originId: string | null;
  destinationId: string | null;
  result: PathResult | null;
  status: 'idle' | 'ready' | 'unreachable' | 'error';
  message: string | null;
  onOriginChange: (id: string | null) => void;
  onDestinationChange: (id: string | null) => void;
  onSwap: () => void;
  onFindRoute: () => void;
  onReset: () => void;
}

export function RoutePlannerPanel({
  locations,
  originId,
  destinationId,
  result,
  status,
  message,
  onOriginChange,
  onDestinationChange,
  onSwap,
  onFindRoute,
  onReset,
}: RoutePlannerPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const options: SelectOption[] = locations.map((location) => ({
    value: location.id,
    label: location.name,
  }));

  const canSubmit = Boolean(originId && destinationId);
  const samePoint = Boolean(originId && originId === destinationId);

  const handleSubmit = () => {
    if (!originId || !destinationId) {
      setError('Choose both a starting location and a destination.');
      return;
    }
    if (samePoint) {
      setError('Choose two different locations to travel between.');
      return;
    }
    setError(null);
    onFindRoute();
  };

  return (
    <Card className="p-4 sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <SelectField
            label="From"
            placeholder="Select a starting location"
            value={originId ?? ''}
            options={options}
            onChange={(event) => onOriginChange(event.target.value || null)}
            autoComplete="off"
          />

          {/* Swap sits between the two fields on wide screens, below them on narrow. */}
          <button
            type="button"
            onClick={onSwap}
            disabled={!originId && !destinationId}
            aria-label="Swap start and destination"
            className="mb-1 hidden h-10 w-10 shrink-0 items-center justify-center self-end rounded-md border border-ink-300 bg-white text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
          >
            <ArrowDownUp size={16} aria-hidden="true" />
          </button>

          <SelectField
            label="To"
            placeholder="Select a destination"
            value={destinationId ?? ''}
            options={options}
            onChange={(event) => onDestinationChange(event.target.value || null)}
            autoComplete="off"
          />
        </div>

        <div className="mt-2 sm:hidden">
          <button
            type="button"
            onClick={onSwap}
            disabled={!originId && !destinationId}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-40"
          >
            <ArrowDownUp size={15} aria-hidden="true" />
            Swap start and destination
          </button>
        </div>

        {(error || message) && (
          <p
            role="alert"
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              error || status === 'error' || status === 'unreachable'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-ink-200 bg-ink-50 text-ink-700'
            }`}
          >
            {error || message}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={!canSubmit || samePoint}
            className="sm:flex-1"
            title={canSubmit ? undefined : 'Choose a start and a destination first'}
          >
            <RouteIcon size={16} aria-hidden="true" />
            Find shortest route
          </Button>
          <Button type="button" variant="secondary" onClick={onReset} disabled={status === 'idle'}>
            <LocateFixed size={16} aria-hidden="true" />
            Reset
          </Button>
        </div>

        {!canSubmit && !error && (
          <p className="mt-2 text-xs text-ink-500">
            Choose a starting location and a destination to enable route calculation.
          </p>
        )}
      </form>

      {result?.reachable && (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-200 pt-4">
          <Metric label="Distance" value={formatDistance(result.distance)} />
          <Metric label="Walking time" value={formatDuration(result.distance)} />
          <Metric label="Stops" value={String(result.path.length)} />
        </dl>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-lg leading-tight font-semibold text-ink-900 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/**
 * The ordered list of buildings along the route.
 *
 * Rendered as an ordered list so the sequence is conveyed structurally, not only by
 * visual connectors. Each step is a button: selecting it moves the map and opens
 * that building's details.
 */
export function RouteSteps({
  graph,
  result,
  onStepClick,
}: {
  graph: CampusGraph;
  result: PathResult;
  onStepClick: (id: string) => void;
}) {
  if (!result.reachable) return null;

  const nameOf = (id: string) => graph.locations.get(id)?.name ?? id;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">Route directions</h2>
        <p className="text-sm text-ink-600">
          {formatDistance(result.distance)} · about {walkingMinutes(result.distance)} min walk ·{' '}
          {result.path.length - 1} segments
        </p>
      </div>

      <ol className="relative space-y-0">
        {result.path.map((id, index) => {
          const location = graph.locations.get(id);
          const isLast = index === result.path.length - 1;
          const legDistance =
            index === 0 ? null : result.edgeIds[index - 1] ? graph.edges.get(result.edgeIds[index - 1])?.distance : null;

          return (
            <li key={`${id}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Connector line, hidden for the final step. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute top-7 bottom-0 left-[13px] w-0.5 bg-route-100"
                />
              )}

              <span
                aria-hidden="true"
                className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                  index === 0 ? 'bg-cgci-700' : isLast ? 'bg-route-600' : 'bg-route-400'
                }`}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => onStepClick(id)}
                  className="text-left text-sm font-medium text-ink-900 underline-offset-2 hover:underline"
                >
                  {nameOf(id)}
                </button>
                <p className="text-xs text-ink-500">
                  {index === 0 ? 'Starting point' : isLast ? 'Destination' : 'Pass through'}
                  {legDistance != null && ` · ${formatDistance(legDistance)}`}
                </p>
                {location && !location.verified && (
                  <p className="mt-0.5 text-xs text-route-600">
                    The site map has not yet named this building.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}