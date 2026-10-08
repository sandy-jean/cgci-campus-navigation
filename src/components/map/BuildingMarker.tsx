/**
 * A single location drawn on the campus site plan.
 *
 * Three footprint kinds mirror the legend of the official site map: a solid
 * building footprint, a dashed outline for an open area, and a gateway symbol.
 *
 * Accessibility notes:
 *   - Each location is a real focusable control (`<g role="button" tabindex>`), so
 *     the whole map is usable with a keyboard in the documented tab order.
 *   - Route state is conveyed by a badge letter *and* a shape change, never by
 *     colour alone.
 *   - Every label is duplicated in the details panel, so nothing important is only
 *     available on hover.
 */

import type { CampusLocation } from '@/types/campus';
import { CATEGORY_STYLES, footprintOf } from '@/utils/mapTheme';

export type BuildingRole = 'origin' | 'destination' | 'intermediate' | 'none';

interface BuildingMarkerProps {
  location: CampusLocation;
  role: BuildingRole;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

const ROLE_LABEL: Record<Exclude<BuildingRole, 'none'>, string> = {
  origin: 'Starting point',
  destination: 'Destination',
  intermediate: 'On your route',
};

export function BuildingMarker({
  location,
  role,
  isSelected,
  isFocused,
  onSelect,
  onFocus,
}: BuildingMarkerProps) {
  const style = CATEGORY_STYLES[location.category] ?? CATEGORY_STYLES.facility;
  const box = footprintOf(location);
  const onRoute = role !== 'none';

  // An open area is wide and flat, so its label goes below; a building's label
  // sits above unless that would run off the top of the canvas.
  const labelBelow = box.kind === 'area' || box.y < 46;
  const labelY = labelBelow ? box.y + box.height + 18 : box.y - 9;

  const stateLabel = onRoute ? ` ${ROLE_LABEL[role as Exclude<BuildingRole, 'none'>]}.` : '';

  return (
    <g
      className="group cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${location.name}. ${style.label}.${stateLabel}${
        location.verified ? '' : ' Name not yet supplied by the college.'
      }`}
      onClick={() => onSelect(location.id)}
      onFocus={() => onFocus(location.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(location.id);
        }
      }}
    >
      {/* Transparent hit area: makes the footprint and its label clickable together. */}
      <rect
        x={box.x - 10}
        y={box.y - 10}
        width={box.width + 20}
        height={box.height + 32}
        fill="transparent"
      />

      {/* Focus ring sits behind the footprint so it never hides the label. */}
      {isFocused && (
        <rect
          x={box.x - 4}
          y={box.y - 4}
          width={box.width + 8}
          height={box.height + 8}
          rx={8}
          fill="none"
          stroke="#2f6b4f"
          strokeWidth={3}
          strokeDasharray="6 4"
        />
      )}

      {box.kind === 'gate' ? (
        <GateSymbol box={box} style={style} isSelected={isSelected} />
      ) : box.kind === 'area' ? (
        <AreaOutline box={box} style={style} isSelected={isSelected} />
      ) : (
        <BuildingFootprint box={box} style={style} isSelected={isSelected} />
      )}

      {/* Route state is also written as a marker badge, so it survives greyscale. */}
      {onRoute && (
        <g transform={`translate(${box.cx - box.width / 2 + 2} ${box.y - 11})`}>
          <rect x={0} y={0} width={role === 'intermediate' ? 74 : 56} height={20} rx={10} fill="#17201d" />
          <text
            x={(role === 'intermediate' ? 74 : 56) / 2}
            y={10}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={700}
            fill="#ffffff"
            letterSpacing="0.08em"
            style={{ pointerEvents: 'none' }}
          >
            {role === 'origin' ? 'START' : role === 'destination' ? 'DEST' : 'ON ROUTE'}
          </text>
        </g>
      )}

      <text
        x={box.cx}
        y={labelY}
        textAnchor="middle"
        fontSize={box.kind === 'area' ? 13 : 14}
        fontWeight={isSelected || onRoute ? 700 : 600}
        fill="#22282a"
        style={{ paintOrder: 'stroke', pointerEvents: 'none' }}
        stroke="#f7f7f4"
        strokeWidth={3.5}
        strokeLinejoin="round"
      >
        {truncate(location.name, box.kind === 'area' ? 24 : 20)}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------- footprints */

function BuildingFootprint({
  box,
  style,
  isSelected,
}: {
  box: ReturnType<typeof footprintOf>;
  style: (typeof CATEGORY_STYLES)[keyof typeof CATEGORY_STYLES];
  isSelected: boolean;
}) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={3}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={isSelected ? 3 : 1.5}
        className="transition-[stroke-width,fill] duration-150 group-hover:brightness-[0.97]"
      />
      {/* Ridge line, echoing the pitched roofs on the site plan. */}
      <line
        x1={box.x + 2}
        y1={box.y + box.height / 2}
        x2={box.x + box.width - 2}
        y2={box.y + box.height / 2}
        stroke={style.stroke}
        strokeWidth={1}
        opacity={0.5}
      />
      {box.width >= 70 && (
        <text
          x={box.cx}
          y={box.cy - 4}
          textAnchor="middle"
          fontSize={15}
          fontWeight={700}
          fill={style.text}
          letterSpacing="0.06em"
          style={{ pointerEvents: 'none' }}
        >
          {style.badge}
        </text>
      )}
    </>
  );
}

function AreaOutline({
  box,
  style,
  isSelected,
}: {
  box: ReturnType<typeof footprintOf>;
  style: (typeof CATEGORY_STYLES)[keyof typeof CATEGORY_STYLES];
  isSelected: boolean;
}) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={6}
        fill={style.fill}
        fillOpacity={0.55}
        stroke={style.stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray="7 5"
        className="transition-[stroke-width] duration-150"
      />
      {/* Centre dot marks where the graph vertex sits inside the open area. */}
      <circle cx={box.cx} cy={box.cy} r={3} fill={style.stroke} opacity={0.7} />
    </>
  );
}

function GateSymbol({
  box,
  style,
  isSelected,
}: {
  box: ReturnType<typeof footprintOf>;
  style: (typeof CATEGORY_STYLES)[keyof typeof CATEGORY_STYLES];
  isSelected: boolean;
}) {
  const postWidth = 7;
  const left = box.x;
  const right = box.x + box.width;

  return (
    <g>
      {/* Threshold line across the road */}
      <line
        x1={box.cx}
        y1={box.y - 6}
        x2={box.cx}
        y2={box.y + box.height + 6}
        stroke={style.stroke}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray="4 4"
      />
      {/* Two gate posts */}
      <rect x={left} y={box.y} width={postWidth} height={box.height} rx={1.5} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} />
      <rect x={right - postWidth} y={box.y} width={postWidth} height={box.height} rx={1.5} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} />
      {/* Barrier arm */}
      <line
        x1={left + postWidth}
        y1={box.y + box.height / 2}
        x2={right - postWidth}
        y2={box.y + box.height / 2}
        stroke={style.stroke}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Shortens a name so it never spills outside the canvas edge. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}