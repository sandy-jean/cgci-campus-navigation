/**
 * Firestore data-access for graph edges (the walking paths).
 *
 * Edge documents follow the shape from the project brief:
 *
 *   { from: 'mainGate', to: 'administration', distance: 45, walkable: true }
 *
 * `direction` extends the brief with one-way support. It defaults to 'both',
 * which is what a campus walkway is.
 */

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import type { CampusEdge } from '@/types/campus';
import { COLLECTIONS, getFirestoreDb } from './firebase';
import { toFriendlyError } from './locations';

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value);

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : fallback;

function toDirection(value: unknown): CampusEdge['direction'] {
  const raw = str(value);
  return raw === 'forward' || raw === 'backward' || raw === 'both' ? raw : 'both';
}

export function normaliseEdge(id: string, data: DocumentData): CampusEdge {
  return {
    id,
    from: str(data.from),
    to: str(data.to),
    distance: typeof data.distance === 'number' ? data.distance : Number(data.distance) || 0,
    walkable: bool(data.walkable, true),
    direction: toDirection(data.direction),
    note: str(data.note).trim() || undefined,
  };
}

export function validateEdge(input: Partial<CampusEdge>, validIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!input.from) errors.push('Choose a starting location.');
  if (!input.to) errors.push('Choose a destination location.');
  if (input.from && input.to && input.from === input.to) {
    errors.push('A path cannot start and end at the same location.');
  }
  if (input.from && !validIds.has(input.from)) errors.push('The starting location is not on the map.');
  if (input.to && !validIds.has(input.to)) errors.push('The destination location is not on the map.');
  if (input.distance == null || !Number.isFinite(input.distance)) {
    errors.push('Distance is required.');
  } else if (input.distance <= 0) {
    errors.push('Distance must be greater than zero.');
  } else if (input.distance > 100000) {
    errors.push('Distance looks implausible (over 100 km). Enter the distance in metres.');
  }
  return errors;
}

/** Subscribes to every walking path on campus. */
export function subscribeToEdges(
  onData: (edges: CampusEdge[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getFirestoreDb(), COLLECTIONS.edges),
    (snapshot) => onData(snapshot.docs.map((item) => normaliseEdge(item.id, item.data()))),
    (error) => onError(toFriendlyError(error)),
  );
}

/**
 * Deterministic id for an undirected connection.
 *
 * Two administrators creating "mainGate -> library" and "library -> mainGate"
 * should converge on one document rather than silently creating a duplicate edge,
 * so the id is derived from the sorted pair.
 */
export function edgeIdFor(from: string, to: string): string {
  return [from, to].sort().join('__');
}

/** Creates or replaces a path. */
export async function saveEdge(edge: CampusEdge): Promise<void> {
  await setDoc(
    doc(getFirestoreDb(), COLLECTIONS.edges, edge.id),
    {
      from: edge.from,
      to: edge.to,
      distance: edge.distance,
      walkable: edge.walkable,
      direction: edge.direction,
      note: edge.note?.trim() ?? '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Flips a path between walkable and closed without deleting it. */
export async function setEdgeWalkable(id: string, walkable: boolean): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), COLLECTIONS.edges, id), {
    walkable,
    updatedAt: serverTimestamp(),
  });
}

/** Removes a path outright. */
export async function deleteEdge(id: string): Promise<void> {
  await setDoc(
    doc(getFirestoreDb(), COLLECTIONS.edges, id),
    { walkable: false, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * All edges touching a location. Used to warn about orphaned paths before a
 * location is deactivated or deleted.
 */
export function edgesTouching(edges: CampusEdge[], locationId: string): CampusEdge[] {
  return edges.filter((edge) => edge.from === locationId || edge.to === locationId);
}