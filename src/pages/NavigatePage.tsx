/**
 * The main navigation page.
 *
 * Responsive layout
 * -----------------
 * Mobile (below `lg`) stacks vertically: search, planning controls, map, then the
 * route result. The map gets a bounded height so the planning controls and the
 * result are always reachable by scrolling, rather than the map pushing them off
 * screen.
 *
 * Desktop (`lg` and up) switches to a two-column split. The sidebar scrolls
 * independently of the map so a long route list never pushes the map out of view,
 * and the map fills the available height exactly.
 *
 * A compact summary bar is pinned to the bottom on mobile once a route exists, so
 * distance and walking time stay visible while scrolling the directions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route as RouteIcon, TriangleAlert } from 'lucide-react';

import { BuildingDetails } from '@/components/buildings/BuildingDetails';
import { CampusMap } from '@/components/map/CampusMap';
import { RoutePlannerPanel, RouteSteps } from '@/components/navigation/RoutePlanner';
import { SearchBar } from '@/components/navigation/SearchBar';
import { Button, EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import { useCampusData } from '@/context/CampusDataContext';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import { trackEvent } from '@/services/analytics';
import { useNavigationStore } from '@/store/navigationStore';
import { formatDistance, formatDuration } from '@/utils/format';

export function NavigatePage() {
  const { graph, status, error, reload, warnings } = useCampusData();
  const { findRoute, reset } = useRoutePlanner();

  const originId = useNavigationStore((state) => state.originId);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const selectedId = useNavigationStore((state) => state.selectedId);
  const focusId = useNavigationStore((state) => state.focusId);
  const focusToken = useNavigationStore((state) => state.focusToken);
  const result = useNavigationStore((state) => state.result);
  const routeStatus = useNavigationStore((state) => state.status);
  const message = useNavigationStore((state) => state.message);

  const setOrigin = useNavigationStore((state) => state.setOrigin);
  const setDestination = useNavigationStore((state) => state.setDestination);
  const swapEndpoints = useNavigationStore((state) => state.swapEndpoints);
  const selectLocation = useNavigationStore((state) => state.selectLocation);
  const focusLocation = useNavigationStore((state) => state.focusLocation);

  const [animationKey, setAnimationKey] = useState('initial');
  const resultRef = useRef<HTMLDivElement>(null);

  const activeLocations = useMemo(
    () => [...graph.locations.values()],
    [graph],
  );

  const selected = selectedId ? graph.locations.get(selectedId) ?? null : null;

  const handleSelect = useCallback(
    (id: string) => {
      selectLocation(id);
      void trackEvent('location_selected', { locationId: id, source: 'map' });
    },
    [selectLocation],
  );

  const handleSearchChoose = useCallback(
    (id: string) => {
      focusLocation(id);
    },
    [focusLocation],
  );

  const handleFindRoute = useCallback(() => {
    if (!originId || !destinationId) return;
    findRoute(graph, originId, destinationId);
    setAnimationKey(`${originId}->${destinationId}-${Date.now()}`);
    void trackEvent('navigation_started', { origin: originId, destination: destinationId });
  }, [originId, destinationId, graph, findRoute]);

  const handleReset = useCallback(() => {
    reset();
    setAnimationKey('reset');
  }, [reset]);

  // Bring the result into view on small screens once it is calculated, so the
  // distance and directions are not left below an unchanged scroll position.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [animationKey]);

  if (status === 'initialising' || status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Campus data could not be loaded"
          message={error ?? 'Unknown error.'}
          action={
            <Button onClick={reload} variant="secondary">
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (activeLocations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={<TriangleAlert size={28} aria-hidden="true" />}
          title="No campus locations yet"
          description="The campus graph has no vertices, so no route can be calculated. An administrator can add buildings from the admin dashboard."
          action={
            <Button onClick={reload} variant="secondary">
              Reload campus data
            </Button>
          }
        />
      </div>
    );
  }

  const routeFound = Boolean(result?.reachable);

  return (
    <div className="relative">
      <div className="mx-auto max-w-[1600px] lg:flex lg:h-[calc(100dvh-3.5rem)] lg:gap-0 lg:overflow-hidden">
        {/* ---------------------------- Controls column ---------------------------- */}
        <section
          aria-label="Route planning"
          className="space-y-4 px-4 py-4 sm:px-6 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-ink-200 lg:bg-white lg:px-5 lg:py-6 xl:w-[420px]"
        >
          <div>
            <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">
              Find your way around campus
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              Choose where you are and where you are going. The route is calculated
              with Dijkstra&apos;s shortest-path algorithm over the campus graph.
            </p>
          </div>

          <SearchBar locations={activeLocations} onChoose={handleSearchChoose} />

          <RoutePlannerPanel
            locations={activeLocations}
            originId={originId}
            destinationId={destinationId}
            result={result}
            status={routeStatus}
            message={message}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onSwap={swapEndpoints}
            onFindRoute={handleFindRoute}
            onReset={handleReset}
          />

          <div ref={resultRef}>
            {routeFound && result && (
              <RouteSteps graph={graph} result={result} onStepClick={focusLocation} />
            )}
          </div>

          <BuildingDetails
            location={selected}
            onUseAsOrigin={setOrigin}
            onUseAsDestination={setDestination}
            onClose={() => selectLocation(null)}
          />

          {warnings.length > 0 && (
            <details className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink-800">
                {warnings.length} data warning{warnings.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-ink-600">
                {warnings.map((warning, index) => (
                  <li key={index} className="border-l-2 border-route-100 pl-2">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="pb-24 text-xs text-ink-500 lg:pb-0">
            {graph.locations.size} locations · {graph.edges.size} walking paths ·{' '}
            shortest path by Dijkstra
          </p>
        </section>

        {/* -------------------------------- Map -------------------------------- */}
        <section
          aria-label="Campus map"
          className="h-[58vh] min-h-[340px] border-y border-ink-200 lg:h-auto lg:min-h-0 lg:flex-1 lg:border-y-0"
        >
          <CampusMap
            graph={graph}
            result={result}
            originId={originId}
            destinationId={destinationId}
            selectedId={selectedId}
            focusId={focusId}
            animationKey={animationKey}
            onSelect={handleSelect}
            onFocusChange={(id) => (id ? selectLocation(id) : selectLocation(null))}
          />
        </section>
      </div>

      {/* Mobile summary bar: keeps the headline numbers on screen while scrolling. */}
      {routeFound && result && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 px-4 py-3 shadow-[0_-2px_10px_rgb(23_28_27/0.08)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-route-50 text-route-600"
            >
              <RouteIcon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">
                {formatDistance(result.distance)} · {formatDuration(result.distance)}
              </p>
              <p className="truncate text-xs text-ink-600">
                {graph.locations.get(result.path[0])?.name} →{' '}
                {graph.locations.get(result.path[result.path.length - 1])?.name}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Re-triggers the map zoom effect when the same building is chosen twice. */}
      <span className="sr-only" aria-live="polite">
        {focusToken > 0 && focusId ? `Map centred on ${graph.locations.get(focusId)?.name}.` : ''}
      </span>
    </div>
  );
}