/**
 * Campus map geometry and styling.
 *
 * The map is a single SVG with a fixed 1000 x 620 coordinate system, matching the
 * proportions of the official CGCI campus site map. Because the SVG carries the
 * viewBox, one set of coordinates renders correctly at any screen size - the drawing
 * scales rather than the data.
 *
 * One map unit is treated as one metre, so a location's position and an edge's
 * distance stay conceptually comparable and the drawing is to scale.
 */

import type { FootprintKind, LocationCategory } from '@/types/campus';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

/** Padding kept around the drawing at the default zoom level. */
export const MAP_PADDING = 20;

export interface CategoryStyle {
  label: string;
  /** Fill for the building footprint. */
  fill: string;
  /** Stroke for the building outline. */
  stroke: string;
  /** Text colour that meets WCAG AA on that fill. */
  text: string;
  /** Two-letter badge, so buildings differ by label as well as by colour. */
  badge: string;
}

/**
 * Colours follow the legend of the official site map: academic buildings are
 * blue-grey, the administrative building is brown, and open grounds and parking
 * are neutral greys.
 */
export const CATEGORY_STYLES: Record<LocationCategory, CategoryStyle> = {
  academic: {
    label: 'Academic',
    fill: '#c8d2dc',
    stroke: '#5c6f80',
    text: '#1f2a33',
    badge: 'AC',
  },
  administrative: {
    label: 'Administrative',
    fill: '#c8a882',
    stroke: '#8a6134',
    text: '#33220f',
    badge: 'AD',
  },
  service: {
    label: 'Service',
    fill: '#b9d3c4',
    stroke: '#3f6b52',
    text: '#16301f',
    badge: 'SV',
  },
  recreation: {
    label: 'Open ground',
    fill: '#dfe3d6',
    stroke: '#8c9578',
    text: '#2c3320',
    badge: 'GR',
  },
  facility: {
    label: 'Facility',
    fill: '#e2e2dd',
    stroke: '#7c7c74',
    text: '#2c2c28',
    badge: 'FC',
  },
  entrance: {
    label: 'Gate',
    fill: '#2f6b4f',
    stroke: '#1a3d2f',
    text: '#ffffff',
    badge: 'GT',
  },
  landmark: {
    label: 'Landmark',
    fill: '#d6cddd',
    stroke: '#6a5a75',
    text: '#2a2330',
    badge: 'LM',
  },
};

/** Default footprint for a building that does not specify its own size. */
export const DEFAULT_BUILDING_WIDTH = 104;
export const DEFAULT_BUILDING_HEIGHT = 56;

/** Default footprint for an open area such as a parking lot or school ground. */
export const DEFAULT_AREA_WIDTH = 150;
export const DEFAULT_AREA_HEIGHT = 92;

/** Footprint for a gate marker. */
export const GATE_WIDTH = 58;
export const GATE_HEIGHT = 26;

/**
 * Returns the corners of a location's footprint.
 *
 * Size can be overridden per location, taken from the site map, so an
 * administrator can make a long building such as CORE 2 read as long without
 * touching layout code.
 */
export function footprintOf(location: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  footprint?: FootprintKind;
}) {
  const kind = location.footprint ?? 'building';
  const defaults =
    kind === 'area'
      ? { width: DEFAULT_AREA_WIDTH, height: DEFAULT_AREA_HEIGHT }
      : kind === 'gate'
        ? { width: GATE_WIDTH, height: GATE_HEIGHT }
        : { width: DEFAULT_BUILDING_WIDTH, height: DEFAULT_BUILDING_HEIGHT };

  const width = location.width ?? defaults.width;
  const height = location.height ?? defaults.height;

  return {
    kind,
    x: location.x - width / 2,
    y: location.y - height / 2,
    width,
    height,
    cx: location.x,
    cy: location.y,
  };
}

/** Clamps a transform so the map can never be panned completely out of view. */
export function clampTransform(x: number, y: number, scale: number) {
  const halfWidth = MAP_WIDTH / 2 / scale;
  const halfHeight = MAP_HEIGHT / 2 / scale;
  return {
    x: Math.min(Math.max(x, -halfWidth + MAP_PADDING), halfWidth - MAP_PADDING),
    y: Math.min(Math.max(y, -halfHeight + MAP_PADDING), halfHeight - MAP_PADDING),
    scale,
  };
}

/**
 * Sites drawn as scenery: surrounding buildings, roads, tree belts and the
 * unlabelled structure at the north-east of the site plan.
 *
 * Purely decorative and marked aria-hidden. They reproduce the official plan's
 * appearance so the schematic reads as the real campus, but they are not graph
 * vertices: the walkable network is defined only by the edges collection.
 */
export const SCENERY = {
  /** Neighbouring blocks outside the campus boundary, as flat grey masses. */
  surroundingBlocks: [
    { x: 6, y: 14, w: 92, h: 96 },
    { x: 6, y: 126, w: 62, h: 120 },
    { x: 6, y: 262, w: 86, h: 96 },
    { x: 6, y: 374, w: 70, h: 118 },
    { x: 96, y: 500, w: 190, h: 74 },
    { x: 300, y: 512, w: 150, h: 62 },
    { x: 470, y: 518, w: 130, h: 56 },
    { x: 630, y: 516, w: 110, h: 58 },
    { x: 760, y: 470, w: 120, h: 104 },
    { x: 892, y: 440, w: 100, h: 134 },
    { x: 890, y: 210, w: 104, h: 210 },
    { x: 878, y: 40, w: 116, h: 150 },
  ],

  /**
   * The large building along the northern boundary of the site plan. It has no
   * label and no documented function, so it carries the provisional name
   * "North Wing" and stays flagged as unverified.
   */
  northWing: [
    { x: 525, y: 118, w: 344, h: 116 },
    { x: 606, y: 60, w: 108, h: 56 },
    { x: 726, y: 42, w: 72, h: 78 },
    { x: 800, y: 88, w: 70, h: 132 },
  ],

  /** Roads: the southern boundary road and the western service road. */
  roads: [
    { x: 0, y: 486, w: 1000, h: 30 },
    { x: 8, y: 0, w: 22, h: 620 },
  ],

  /** Tree clusters, drawn as soft green canopies. */
  trees: [
    { x: 62, y: 262, r: 26 },
    { x: 96, y: 306, r: 20 },
    { x: 152, y: 268, r: 30 },
    { x: 188, y: 310, r: 22 },
    { x: 232, y: 230, r: 28 },
    { x: 268, y: 286, r: 18 },
    { x: 322, y: 258, r: 20 },
    { x: 452, y: 330, r: 24 },
    { x: 484, y: 366, r: 20 },
    { x: 520, y: 330, r: 26 },
    { x: 556, y: 262, r: 20 },
    { x: 604, y: 272, r: 22 },
    { x: 512, y: 440, r: 30 },
    { x: 560, y: 470, r: 22 },
    { x: 604, y: 440, r: 26 },
    { x: 644, y: 472, r: 18 },
    { x: 736, y: 200, r: 26 },
    { x: 782, y: 172, r: 22 },
    { x: 824, y: 208, r: 20 },
    { x: 872, y: 214, r: 24 },
    { x: 902, y: 300, r: 18 },
    { x: 936, y: 372, r: 22 },
    { x: 148, y: 336, r: 16 },
  ],
} as const;