# CGCI Campus Navigation

An interactive campus navigation system for **Core Gateway College, Inc.** — built as a
Discrete Structures 1 project that treats the campus as a graph.

**Live site:** https://cgci-campus-navigation.web.app

A visitor picks a starting point and a destination, and the system finds the shortest
walking route using **Dijkstra's algorithm** over a graph whose vertices are campus
locations and whose edges are the walkable paths between them. The same graph is also
rendered as an adjacency list, an adjacency matrix and a reachability report on a
dedicated **Discrete Structures** page, all computed from live Firestore data rather
than from hard-coded examples.

---

## What it demonstrates

| Concept | Where it lives |
| --- | --- |
| Graph model `G = (V, E)` | `src/algorithms/graph.ts` |
| Adjacency list | `src/algorithms/adjacencyList.ts` |
| Adjacency matrix (binary and weighted) | `src/algorithms/adjacencyMatrix.ts` |
| Dijkstra's shortest path, binary-heap | `src/algorithms/dijkstra.ts` |
| BFS and reachability | `src/algorithms/bfs.ts` |
| Degree, density, connected components | `computeStats` in `graph.ts` |

No pathfinding logic lives in any React component. `dijkstra()` and `bfs()` are plain
functions over plain data, which is what makes them testable in isolation and quotable
in a report.

### Why both BFS and Dijkstra

BFS minimises the number of edges crossed. Dijkstra minimises the total distance
walked. On a campus those are different questions, and only the second is what someone
asking for a route cares about. BFS is therefore used for **reachability** — "can B be
reached from A?" — where edge-count layering is exactly right, while Dijkstra computes
the route.

---

## The campus data

The dataset in `src/data/campusLayout.json` is transcribed from the official
**Core Gateway College, Inc. Campus Site Map** (1920 × 1120). Building names, footprints,
floor assignments and open areas come from that drawing. Vertex coordinates are that
drawing projected onto the map's 1000 × 620 canvas, preserving relative position.

Current graph: **15 vertices, 22 walking paths** (21 open, 1 closed for demonstration),
one connected component, mean degree 2.80, density 0.200.

### Three things the source map does not tell us

These are stated rather than hidden, and all are editable in the admin dashboard:

1. **Six locations are labelled "BLDG. NAME" on the official plan.** The clinic
   building, the student affairs building, the senior high school building, and the
   large northern building are all unnamed by the college. This system labels them by
   the functions the plan documents inside them — "Clinic Building", "Student Affairs
   Building", "Senior High School Building", "North Wing" — so they can be routed to at
   all. Those names are **not official**, the entries are flagged `verified: false`, and
   a banner on every public page says so until an administrator replaces them.
2. **Walkway distances are estimates.** The site plan has no scale bar. Distances were
   derived from the projection and rounded to plausible walking lengths in metres.
3. **The CORE 1 → Clinic Building path is stored closed.** This is a demonstration of
   how reopening a path changes the shortest route (200 m becomes 85 m for CORE 1 to
   the central parking area), **not** a real closure on campus. Open it from
   **Admin → Paths** and recalculate.

The site plan's legend also lists "Buildings (Academic)" twice with different colours,
so colour alone cannot separate building types. Categories in this system are assigned
by the functions the plan documents inside each building.

---

## Features

**Public**

- Interactive SVG site plan, clickable and keyboard-navigable, drawn to scale from the graph itself
- Search across buildings, offices, laboratories and facilities, with ranked results
- Route planning: choose start and destination, get distance, walking time and ordered directions
- Animated route drawing with numbered steps and distinct start/end markers
- Full campus directory with category filters
- **Discrete Structures** page: live adjacency list, adjacency matrix, reachability checker, BFS order, Dijkstra trace and complexity analysis — all generated from current data
- Responsive from 320 px phones to wide desktops; the map zooms to a building on selection
- Works with JavaScript keyboard-only, respects `prefers-reduced-motion`, and never relies on colour alone to convey state

**Administrator** (`/admin`, behind Firebase Authentication)

- Locations: create, edit, deactivate/reactivate, permanently delete, mark verified
- Paths: create, edit, close/reopen, remove, with validated distances
- Graph inspector: walkable map, adjacency list, adjacency matrix, and a full distance table from any building
- Overview: graph health checks, provenance warnings, and the list of analytics events with explanations

---

## Security model

Campus navigation data is **public**: every visitor needs it to route, and a campus plan
is not sensitive. Writes are the protected half.

Administrator access is an **allowlist**: a signed-in user is an administrator when a
document exists at `admins/{their own email}`. Only an existing administrator may add or
remove entries, so nobody can promote themselves. The rules are in `firestore.rules`;
the React admin menu is user-interface polish, not the boundary.

Rules additionally enforce data integrity at the database edge: a path cannot have a
zero or negative distance (which would break Dijkstra's non-negative-weight assumption),
cannot join a building to itself, and must reference locations that actually exist.
Unknown collections are denied by default, so a new collection fails safe.

Verify the deployed rules with:

```bash
npm run verify:rules
```

---

## Analytics

Firebase Analytics records `page_view`, `location_search`, `location_selected`,
`building_viewed`, `route_requested`, `route_completed`, `route_unavailable`,
`navigation_started`, `navigation_reset`, and admin CRUD events.

**No personal data is collected.** Locations are referenced by opaque document id, never
by name. No email address, uid or any other identifier is ever sent. Every call is
fire-and-forget and swallows its own errors, so a blocked or unavailable analytics
pipeline can never interrupt navigation.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # Firebase Web config
npm run dev                    # http://localhost:5173
```

The Firebase **Web** configuration values in `.env.example` are client-side identifiers,
not secrets — Firebase's own SDK ships them in every deployed browser bundle, and access
is governed by Security Rules and API-key restrictions. No service-account key belongs in
this repository, and none is present.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Algorithm test suite (41 tests) |
| `npm run typecheck` | TypeScript only |
| `npm run seed` | Load the campus dataset into Firestore |
| `npm run verify:rules` | Assert the deployed security rules behave as designed |
| `npm run deploy` | Build, then deploy hosting |

### Seeding the database

```bash
npm run seed                                        # add only missing documents
SEED_MODE=overwrite npm run seed                    # update existing documents
SEED_MODE=overwrite SEED_PRUNE=1 npm run seed       # also remove stale documents
```

The default mode never overwrites or deletes anything, so it is safe to run against a
database that already holds real data.

### Granting administrator access

```bash
node .tools/provision-admin.mjs <email> [password]
```

Creates the Firebase account if needed and adds the address to the `admins` allowlist.
Afterwards an existing administrator can also add colleagues from **Admin → Overview**,
with no command line involved.

---

## Testing

The 41-test suite in `src/algorithms/algorithms.test.ts` covers the parts where a bug
would be invisible in the interface:

- **Dijkstra is cross-checked against an independent Bellman-Ford implementation** on
  every ordered pair of campus vertices. Bellman-Ford is deliberately naive and
  structurally unlike the binary-heap Dijkstra, so agreement is real evidence rather
  than the same bug reported twice.
- Every returned path is re-measured by walking its real edges and summing them
  independently of the algorithm's own reported distance.
- Matrix cells are compared against the adjacency list for every pair of vertices.
- BFS and Dijkstra are required to agree on reachability for every source vertex.
- Empty graphs, single-vertex graphs, self-loops, invalid weights, duplicate edges,
  dangling endpoints, closed paths and one-way paths all have explicit cases.

```bash
npm test
```

---

## Project structure

```
src/
├── algorithms/      # Pure graph code. No React. This is the project.
│   ├── graph.ts           # Graph construction, degree, density, components
│   ├── dijkstra.ts        # Shortest path, binary min-heap
│   ├── bfs.ts             # Reachability and connected components
│   ├── adjacencyList.ts   # Adjacency list, as data and as copyable TypeScript
│   ├── adjacencyMatrix.ts # Binary and weighted matrices, markdown export
│   └── algorithms.test.ts # 41 tests
├── components/
│   ├── map/           # SVG site plan, building footprints, route overlay
│   ├── navigation/    # Search, route planner, directions
│   ├── buildings/     # Building details panel
│   ├── ui/            # Buttons, forms, dialogs, toasts, empty and error states
│   ├── layout/        # Application shell
│   └── auth/          # Admin route guard
├── context/           # Campus data and authentication state
├── data/              # campusLayout.json — transcribed from the official site map
├── hooks/             # Route planning, SPA page-view reporting
├── pages/             # Routes, including the admin section
├── services/          # Firebase: locations, edges, auth, analytics
├── store/             # Zustand navigation UI state
├── styles/            # Design tokens and base styles
├── types/             # Domain types
└── utils/             # Formatting, search ranking, map geometry and theming
```

Data flows one way:

```
Firestore → locations + edges → buildGraph → adjacency list → Dijkstra / BFS
          → shortest path → interactive site plan → user
```

---

## Tech stack

React 19 · TypeScript · Vite · React Router 7 · Tailwind CSS 4 · Firebase
(Authentication, Cloud Firestore, Hosting, Analytics) · Zustand · Framer Motion ·
Lucide icons · Vitest

Admin routes are lazy-loaded, so a visitor who only wants directions never downloads the
dashboard. Campus data is fetched with two Firestore listeners and the graph is built
once per data change, then reused across every route calculation.

---

## Known limitations

- Walkway distances are estimates, not surveyed (see above).
- Dijkstra is single-source per request. For a much larger campus, run it once per
  building and cache the distance table — `dijkstraFromSource()` already returns the
  whole table from one pass, and the admin dashboard uses exactly that.
- The map offers focus-to-zoom but not free panning or pinch-zoom.
- Routes are guidance, not official wayfinding.

---

## Academic integrity note

This system implements graph theory as described in the Discrete Structures 1 project
brief: campus locations as vertices, walking paths as edges, adjacency-list and
adjacency-matrix storage, BFS for reachability, and Dijkstra for shortest paths. Every
figure shown in the interface is computed from the live graph at the moment it is
rendered, so any claim made during a demonstration can be checked against the running
system immediately.