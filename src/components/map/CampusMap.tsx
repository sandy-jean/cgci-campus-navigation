/**
 * The interactive campus site plan.
 *
 * Rendering strategy: a single SVG with `viewBox="0 0 1000 620"` and
 * `preserveAspectRatio="xMidYMid meet"`. The drawing therefore scales to any
 * container without JavaScript measuring anything, which is what keeps the map
 * correct from a 320 px phone to a wide desktop and avoids a resize listener.
 *
 * Layer order, bottom to top:
 *   surrounding blocks -> north wing -> roads -> trees -> boundary -> walkways ->
 *   locations -> route
 * The route paints over the walkways so it is never hidden by scenery.
 *
 * The walkway layer is the graph itself: every open edge in the `edges` collection
 * is drawn to scale, so the picture and the routing engine cannot disagree.
 */

import { useEffect, useMemo, useState } from 'react';

import type { CampusGraph } from '@/algorithms/graph';
import type { CampusLocation, PathResult } from '@/types/campus';
import {
  CATEGORY_STYLES,
  MAP_HEIGHT,
  MAP_WIDTH,
  SCENERY,
  clampTransform,
} from '@/utils/mapTheme';
import { BuildingMarker, type BuildingRole } from './BuildingMarker';
import { RouteOverlay } from './RouteOverlay';

interface CampusMapProps {
  graph: CampusGraph;
  result: PathResult | null;
  originId: string | null;
  destinationId: string | null;
  selectedId: string | null;
  /** Location to zoom to; the map returns to full view when set to null. */
  focusId: string | null;
  /** Changes whenever a route is recalculated, to replay the draw-on animation. */
  animationKey: string;
  onSelect: (id: string) => void;
  onFocusChange: (id: string | null) => void;
  /** Hidden for the compact map used in the admin graph inspector. */
  showLegend?: boolean;
}

export function CampusMap({
  graph,
  result,
  originId,
  destinationId,
  selectedId,
  focusId,
  animationKey,
  onSelect,
  onFocusChange,
  showLegend = true,
}: CampusMapProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrowQuery = window.matchMedia('(max-width: 640px)');
    const sync = () => {
      setReducedMotion(motionQuery.matches);
      setIsNarrow(narrowQuery.matches);
    };
    sync();
    motionQuery.addEventListener('change', sync);
    narrowQuery.addEventListener('change', sync);
    return () => {
      motionQuery.removeEventListener('change', sync);
      narrowQuery.removeEventListener('change', sync);
    };
  }, []);

  // Which vertex plays which role on the drawn route.
  const roles = useMemo(() => {
    const map = new Map<string, BuildingRole>();
    if (!result?.reachable) return map;
    result.path.forEach((id, index) => {
      if (index === 0) map.set(id, 'origin');
      else if (index === result.path.length - 1) map.set(id, 'destination');
      else map.set(id, 'intermediate');
    });
    return map;
  }, [result]);

  // Zoom onto a focused location. Phones zoom further, because the whole site plan
  // shrinks to an unreadable strip on a narrow screen.
  const transform = useMemo(() => {
    const target = focusId ? graph.locations.get(focusId) : undefined;
    if (!target) return clampTransform(0, 0, 1);
    const scale = isNarrow ? 2.4 : 1.6;
    return clampTransform(
      MAP_WIDTH / 2 - target.x * scale,
      MAP_HEIGHT / 2 - target.y * scale,
      scale,
    );
  }, [focusId, graph, isNarrow]);

  const walkways = useMemo(
    () =>
      [...graph.edges.values()]
        .filter((edge) => graph.locations.has(edge.from) && graph.locations.has(edge.to))
        .map((edge) => {
          const from = graph.locations.get(edge.from)!;
          const to = graph.locations.get(edge.to)!;
          return {
            id: edge.id,
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            closed: !edge.walkable,
          };
        }),
    [graph],
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f7f7f4]">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="group"
          aria-label="Interactive campus site plan. Use Tab to move between locations and Enter to open a location's details."
        >
          <g
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: `${MAP_WIDTH / 2}px ${MAP_HEIGHT / 2}px`,
              transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Campus ground */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f7f7f4" />
            <rect x={30} y={14} width={944} height={472} fill="#f2f4ef" />

            {/* Neighbouring blocks outside the campus boundary. */}
            <g aria-hidden="true" fill="#e6e5e1" stroke="#d5d4cf" strokeWidth={1}>
              {SCENERY.surroundingBlocks.map((block, index) => (
                <rect key={index} x={block.x} y={block.y} width={block.w} height={block.h} rx={2} />
              ))}
            </g>

            {/* The North Wing: large, unlabelled on the official plan. */}
            <g aria-hidden="true">
              {SCENERY.northWing.map((block, index) => (
                <rect
                  key={index}
                  x={block.x}
                  y={block.y}
                  width={block.w}
                  height={block.h}
                  rx={2}
                  fill="#cdd6de"
                  stroke="#93a1ac"
                  strokeWidth={1.25}
                />
              ))}
              {SCENERY.northWing.map((block, index) => (
                <line
                  key={`ridge-${index}`}
                  x1={block.x + 2}
                  y1={block.y + block.h / 2}
                  x2={block.x + block.w - 2}
                  y2={block.y + block.h / 2}
                  stroke="#93a1ac"
                  strokeWidth={1}
                  opacity={0.6}
                />
              ))}
            </g>

            {/* Roads. */}
            <g aria-hidden="true">
              {SCENERY.roads.map((road, index) => (
                <rect key={index} x={road.x} y={road.y} width={road.w} height={road.h} fill="#e2e0da" />
              ))}
              <line x1={0} y1={501} x2={MAP_WIDTH} y2={501} stroke="#cfcdc6" strokeWidth={1.5} />
            </g>

            {/* Tree belts. */}
            <g aria-hidden="true">
              {SCENERY.trees.map((tree, index) => (
                <circle key={index} cx={tree.x} cy={tree.y} r={tree.r} fill="#b9cfae" opacity={0.75} />
              ))}
              {SCENERY.trees.map((tree, index) => (
                <circle
                  key={`ring-${index}`}
                  cx={tree.x}
                  cy={tree.y}
                  r={tree.r * 0.62}
                  fill="#9dba90"
                  opacity={0.55}
                />
              ))}
            </g>

            {/* Campus boundary: the site plan draws a green edge along the
                western and southern sides. */}
            <path
              d="M 30 486 V 14 H 974"
              fill="none"
              stroke="#4d6b3f"
              strokeWidth={5}
              strokeLinecap="square"
              opacity={0.5}
            />

            {/* Walkways: the graph, drawn to scale */}
            <g aria-hidden="true" strokeLinecap="round">
              {walkways.map((path) => (
                <line
                  key={path.id}
                  x1={path.x1}
                  y1={path.y1}
                  x2={path.x2}
                  y2={path.y2}
                  stroke={path.closed ? '#c0a98d' : '#ffffff'}
                  strokeWidth={path.closed ? 5 : 7}
                  strokeDasharray={path.closed ? '9 9' : undefined}
                />
              ))}
            </g>

            {/* Locations */}
            <g>
              {graph.nodes.map((id) => {
                const location = graph.locations.get(id) as CampusLocation;
                return (
                  <BuildingMarker
                    key={id}
                    location={location}
                    role={roles.get(id) ?? 'none'}
                    isSelected={selectedId === id || originId === id || destinationId === id}
                    isFocused={focusId === id}
                    onSelect={onSelect}
                    onFocus={onFocusChange}
                  />
                );
              })}
            </g>

            {/* Route */}
            {result?.reachable && result.path.length > 1 && (
              <RouteOverlay graph={graph} result={result} animationKey={animationKey} />
            )}
          </g>
        </svg>

        {/* Reset-view control, only meaningful once zoomed in. */}
        {focusId && (
          <button
            type="button"
            onClick={() => onFocusChange(null)}
            className="absolute top-3 right-3 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-ink-50"
          >
            Show whole campus
          </button>
        )}

        {/* Route summary, mirrored as text so it is not conveyed by colour alone. */}
        {result?.reachable && result.path.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-route-100 bg-white/95 px-3 py-2 text-sm shadow-sm">
            <span className="font-semibold text-ink-800">{result.path.length} stops</span>
            <span className="text-ink-500"> · </span>
            <span className="font-semibold text-route-600">{Math.round(result.distance)} m</span>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="border-t border-ink-200 bg-white px-4 py-3">
          <h3 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Map key</h3>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
              <li key={key} className="flex items-center gap-2 text-sm text-ink-700">
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-7 rounded-sm border-2"
                  style={{ backgroundColor: style.fill, borderColor: style.stroke }}
                />
                {style.label}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-ink-700">
              <span
                aria-hidden="true"
                className="inline-block h-1 w-7 rounded-full"
                style={{ backgroundColor: '#e08c12' }}
              />
              Shortest route
            </li>
            <li className="flex items-center gap-2 text-sm text-ink-700">
              <span
                aria-hidden="true"
                className="inline-block h-1 w-7 rounded-full"
                style={{ backgroundColor: '#c0a98d' }}
              />
              Closed path
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}