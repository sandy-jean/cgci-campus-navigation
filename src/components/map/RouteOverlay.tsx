/**
 * The animated route overlay.
 *
 * Three layers, painted in order:
 *   1. a white casing under the route, so the line stays legible where it crosses
 *      a building or a road;
 *   2. the route polyline itself, in the reserved route amber;
 *   3. directional chevrons and step markers along the way.
 *
 * The draw-on effect uses stroke-dasharray rather than an SVG path-length
 * measurement: `pathLength="1"` normalises the geometry to a single unit, so the
 * same CSS works for every route regardless of its real length.
 */

import { motion } from 'framer-motion';

import type { CampusGraph } from '@/algorithms/graph';
import type { PathResult } from '@/types/campus';

interface RouteOverlayProps {
  graph: CampusGraph;
  result: PathResult;
  /** Re-triggers the draw-on animation when this value changes. */
  animationKey: string;
}

export function RouteOverlay({ graph, result, animationKey }: RouteOverlayProps) {
  if (!result.reachable || result.path.length < 2) return null;

  const points = result.path
    .map((id) => graph.locations.get(id))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))
    .map((location) => `${location.x},${location.y}`)
    .join(' ');

  const origin = graph.locations.get(result.path[0]);
  const destination = graph.locations.get(result.path[result.path.length - 1]);

  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {/* Casing */}
      <polyline
        points={points}
        fill="none"
        stroke="#ffffff"
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.92}
      />

      {/* Route */}
      <motion.polyline
        key={`route-${animationKey}`}
        points={points}
        fill="none"
        stroke="#e08c12"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        initial={{ strokeDasharray: '1 1', strokeDashoffset: 1 }}
        animate={{ strokeDasharray: '1 0', strokeDashoffset: 0 }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />

      {/* Travelling highlight, so the direction of travel is obvious without motion cues alone. */}
      <polyline
        className="route-dash"
        points={points}
        fill="none"
        stroke="#ffcf7a"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.02 0.06"
        style={{ animation: 'route-flow 2.4s linear infinite' }}
      >
        <animateTransform
          attributeName="stroke-dashoffset"
          from="0.08"
          to="0"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </polyline>

      {origin && <EndpointMarker x={origin.x} y={origin.y} kind="start" />}
      {destination && <EndpointMarker x={destination.x} y={destination.y} kind="end" />}

      {/* Step numbers on the intermediate buildings. */}
      {result.path.slice(1, -1).map((id, index) => {
        const location = graph.locations.get(id);
        if (!location) return null;
        return (
          <g key={id} transform={`translate(${location.x} ${location.y + 40})`}>
            <circle r={11} fill="#ffffff" stroke="#c26f08" strokeWidth={2.5} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={700}
              fill="#c26f08"
            >
              {index + 2}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function EndpointMarker({
  x,
  y,
  kind,
}: {
  x: number;
  y: number;
  kind: 'start' | 'end';
}) {
  const fill = kind === 'start' ? '#276248' : '#c26f08';
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={17} fill="#ffffff" stroke={fill} strokeWidth={3} />
      {kind === 'start' ? (
        // Flag glyph: start and end differ in shape, not only in colour.
        <path d="M-5 7 V-7 L7 -3 L-5 1 Z" fill={fill} />
      ) : (
        <path
          d="M0 -8 C4.5 -8 8 -3.5 8 1 C8 6 0 11 0 11 C0 11 -8 6 -8 1 C-8 -3.5 -4.5 -8 0 -8 Z"
          fill={fill}
        />
      )}
    </g>
  );
}