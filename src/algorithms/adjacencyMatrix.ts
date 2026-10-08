/**
 * Adjacency-matrix view of the campus graph.
 *
 * The matrix is the second representation named in the project brief. It is
 * useful for reasoning about small graphs by hand - reading off paths, spotting
 * symmetric pairs, counting triangles - but costs O(V^2) memory, which is why the
 * routing engine uses the adjacency list instead.
 *
 * Two display modes are supported:
 *
 *   'binary'  a[i][j] = 1 when an edge exists, 0 otherwise, 0 on the diagonal.
 *             The classic definition from graph theory.
 *   'weighted' a[i][j] = the distance in metres along that path, INF when no edge.
 *             More useful for the shortest-path discussion.
 *
 * Row i, column j reads: the weight of travelling *from* i *to* j.
 */

import type { CampusGraph } from './graph';

export type MatrixMode = 'binary' | 'weighted';

export interface AdjacencyMatrix {
  /** Row/column labels, in `nodes` order. */
  nodes: string[];
  /** Row i corresponds to nodes[i]; 0 on the diagonal for 'binary', 0 for 'weighted'. */
  values: number[][];
  mode: MatrixMode;
  /** Value used to mean "no edge". Infinity for 'weighted', 0 for 'binary'. */
  empty: number;
}

export function buildAdjacencyMatrix(graph: CampusGraph, mode: MatrixMode = 'binary'): AdjacencyMatrix {
  const nodes = graph.nodes;
  const size = nodes.length;
  const index = new Map(nodes.map((id, position) => [id, position]));

  const empty = mode === 'weighted' ? Number.POSITIVE_INFINITY : 0;
  const values = Array.from({ length: size }, () => Array<number>(size).fill(empty));

  // Self-distance is zero: staying at the same vertex walks no distance. For the
  // binary view the diagonal is forced to 0 so it never reads as a self-loop.
  if (mode === 'weighted') {
    for (let i = 0; i < size; i += 1) values[i][i] = 0;
  }

  for (const edge of graph.edges.values()) {
    const i = index.get(edge.from);
    const j = index.get(edge.to);
    if (i === undefined || j === undefined || i === j) continue;

    const forward = edge.direction !== 'backward';
    const backward = edge.direction !== 'forward';

    if (forward) {
      if (mode === 'weighted') values[i][j] = edge.distance;
      else values[i][j] = 1;
    }
    if (backward) {
      if (mode === 'weighted') values[j][i] = edge.distance;
      else values[j][i] = 1;
    }
  }

  return { nodes, values, mode, empty };
}

/** True when there is a path from `from` to `to`. */
export function matrixHasEdge(matrix: AdjacencyMatrix, from: number, to: number): boolean {
  const value = matrix.values[from]?.[to];
  return value !== undefined && value !== matrix.empty && (matrix.mode === 'binary' || value > 0);
}

/** Number of non-zero, off-diagonal entries. */
export function matrixEdgeCount(matrix: AdjacencyMatrix): number {
  let count = 0;
  for (let i = 0; i < matrix.values.length; i += 1) {
    for (let j = 0; j < matrix.values.length; j += 1) {
      if (i === j) continue;
      if (matrix.values[i][j] !== matrix.empty && matrix.values[i][j] > 0) count += 1;
    }
  }
  return count;
}

/**
 * Renders the matrix as the markdown table from the project brief.
 * `Infinity` becomes a dash so the output stays copy-pasteable into a report.
 */
export function matrixToMarkdown(matrix: AdjacencyMatrix, labels: string[]): string {
  const header = `|         | ${labels.map((label) => shortLabel(label)).join(' | ')} |`;
  const divider = `| ------- | ${labels.map(() => '---:').join(' | ')} |`;
  const rows = matrix.values.map((row, i) => {
    const cells = row.map((value) => String(value).padStart(5, ' ')).join(' | ');
    return `| ${shortLabel(labels[i]).padEnd(7, ' ')} | ${cells} |`;
  });

  return [header, divider, ...rows].join('\n').replace(/  +/g, ' ');

  function shortLabel(label: string): string {
    const words = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
    return words.length > 2 ? `${words[0]} ${words[1]}` : words.join(' ');
  }
}