/**
 * Domain types shared across the application.
 *
 * The campus is modelled as a weighted graph G = (V, E):
 *   V = campus locations (vertices)
 *   E = walkable connections (edges, weighted by distance in metres)
 */

/** Broad category of a campus location, used for map styling and filtering. */
export type LocationCategory =
  | 'academic'
  | 'administrative'
  | 'service'
  | 'recreation'
  | 'facility'
  | 'entrance'
  | 'landmark';

/**
 * How a location is drawn on the site plan.
 *
 *   building - a footprint with a solid outline and a category badge
 *   area     - an open area such as a parking lot or school ground
 *   gate     - a campus gate, drawn as a gateway symbol
 *
 * Taken from the legend of the official CGCI campus site map, which distinguishes
 * academic buildings, administrative buildings, roads, school grounds and trees.
 */
export type FootprintKind = 'building' | 'area' | 'gate';

/**
 * A navigable campus location - one vertex of the graph.
 *
 * `x` / `y` place the location on the schematic campus map. The SVG viewBox is
 * 1000 x 620, and one unit is treated as one metre so that map geometry and the
 * `distance` values on edges stay conceptually consistent.
 *
 * `verified` is a provenance flag, not a display preference. Entries transcribed
 * from the official CGCI campus site map carry `verified: true`; the three
 * buildings the map itself still labels "BLDG. NAME" stay false until the college
 * supplies their names.
 */
export interface CampusLocation {
  id: string;
  name: string;
  description?: string;
  category: LocationCategory;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  footprint?: FootprintKind;
  image?: string;
  facilities?: string[];
  operatingHours?: string;
  isActive: boolean;
  verified?: boolean;
  keywords?: string[];
  sortOrder?: number;
}

/** A walkable connection between two locations - one edge of the graph. */
export interface CampusEdge {
  id: string;
  from: string;
  to: string;
  /** Distance in metres. Must be > 0 for the edge to be usable by Dijkstra. */
  distance: number;
  walkable: boolean;
  /**
   * 'both'    - walkable in either direction (the default for campus paths)
   * 'forward' - only `from` -> `to`
   * 'backward'- only `to` -> `from`
   */
  direction: 'both' | 'forward' | 'backward';
  /** Optional note, e.g. why a path is closed. */
  note?: string;
}

/** The result of a shortest-path computation. */
export interface PathResult {
  /** Ordered vertex ids from start to destination, inclusive. */
  path: string[];
  /** Total distance in metres. Unreachable results use -1. */
  distance: number;
  reachable: boolean;
  /** Edge ids traversed, aligned with `path`. */
  edgeIds: string[];
  /** Nodes popped from the priority queue, in visit order (teaching aid). */
  visitOrder: string[];
  /** Number of vertex relaxations performed. */
  relaxations: number;
}

export interface BfsResult {
  /** Vertices in breadth-first visit order. */
  order: string[];
  /** Distance in edges from the source to every reachable vertex. */
  hops: Record<string, number>;
  /** Ids that were visited, used for highlighting. */
  visited: Set<string>;
}

/** Adjacency list: node id -> list of outgoing edges. */
export type AdjacencyList = Record<string, Array<{ node: string; distance: number; edgeId: string }>>;

export interface GraphStats {
  vertices: number;
  edges: number;
  walkableEdges: number;
  /** Connected components, using undirected adjacency. */
  components: number;
  componentSizes: number[];
  /** 2E / (V(V-1)), the simple-graph density. 0 when V < 2. */
  density: number;
  /** Mean undirected degree, 2E / V. */
  averageDegree: number;
  selfLoops: number;
  /** Undirected degree per vertex: each path counts once at each endpoint. */
  degree: Record<string, number>;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
}