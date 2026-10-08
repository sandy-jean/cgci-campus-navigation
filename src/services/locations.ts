/**
 * Firestore data-access for campus locations (the vertices of the graph).
 *
 * Documents are normalised on read. Firestore is schemaless and an administrator
 * may have saved a partial document, so every field is coerced to the type the UI
 * expects and anything unusable falls back to a safe default. A malformed record
 * degrades one card; it never breaks the map.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import type { CampusLocation, FootprintKind, LocationCategory } from '@/types/campus';
import { COLLECTIONS, getFirestoreDb } from './firebase';

const VALID_CATEGORIES: LocationCategory[] = [
  'academic',
  'administrative',
  'service',
  'recreation',
  'facility',
  'entrance',
  'landmark',
];

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value);

const num = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : fallback;

const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => str(item)).filter(Boolean) : [];

function toCategory(value: unknown): LocationCategory {
  const raw = str(value).toLowerCase() as LocationCategory;
  return VALID_CATEGORIES.includes(raw) ? raw : 'facility';
}

const VALID_FOOTPRINTS: FootprintKind[] = ['building', 'area', 'gate'];

function toFootprint(value: unknown): FootprintKind {
  const raw = str(value).toLowerCase() as FootprintKind;
  return VALID_FOOTPRINTS.includes(raw) ? raw : 'building';
}

/** Converts a raw Firestore document into a typed CampusLocation. */
export function normaliseLocation(id: string, data: DocumentData): CampusLocation {
  return {
    id,
    name: str(data.name, 'Unnamed location').trim() || 'Unnamed location',
    description: str(data.description).trim() || undefined,
    category: toCategory(data.category),
    type: str(data.type, 'Campus location').trim() || 'Campus location',
    x: num(data.x, 0),
    y: num(data.y, 0),
    width: data.width != null ? num(data.width, 0) : undefined,
    height: data.height != null ? num(data.height, 0) : undefined,
    footprint: toFootprint(data.footprint),
    image: str(data.image).trim() || undefined,
    facilities: strArray(data.facilities),
    operatingHours: str(data.operatingHours).trim() || undefined,
    isActive: bool(data.isActive, true),
    verified: bool(data.verified, false),
    keywords: strArray(data.keywords).map((word) => word.toLowerCase()),
    sortOrder: num(data.sortOrder, 999),
  };
}

/**
 * Validation before a write, so the administrator gets a precise message instead
 * of a generic Firestore error and a half-saved record.
 */
export function validateLocation(input: Partial<CampusLocation>): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('Name is required.');

  const { x, y } = input;
  if (x == null || !Number.isFinite(x)) errors.push('Map X position must be a number.');
  else if (x < 0 || x > 1000) errors.push('Map X position must sit inside the campus (0-1000).');

  if (y == null || !Number.isFinite(y)) errors.push('Map Y position must be a number.');
  else if (y < 0 || y > 620) errors.push('Map Y position must sit inside the campus (0-620).');

  return errors;
}

function toDocument(location: CampusLocation): DocumentData {
  return {
    name: location.name.trim(),
    description: location.description?.trim() ?? '',
    category: location.category,
    type: location.type.trim() || 'Campus location',
    x: location.x,
    y: location.y,
    ...(location.width != null ? { width: location.width } : {}),
    ...(location.height != null ? { height: location.height } : {}),
    footprint: location.footprint ?? 'building',
    image: location.image ?? '',
    facilities: location.facilities ?? [],
    operatingHours: location.operatingHours?.trim() ?? '',
    isActive: location.isActive,
    verified: location.verified ?? false,
    keywords: location.keywords ?? [],
    sortOrder: location.sortOrder ?? 999,
    updatedAt: new Date().toISOString(),
  };
}

/** One-shot read of every location, for seeding and verification scripts. */
export async function fetchLocations(): Promise<CampusLocation[]> {
  const snapshot = await getDocs(collection(getFirestoreDb(), COLLECTIONS.locations));
  return snapshot.docs.map((item) => normaliseLocation(item.id, item.data()));
}

/**
 * Subscribes to every location in the campus.
 *
 * A single `onSnapshot` listener keeps the map, the search index, the graph and
 * the admin tables consistent with each other without any manual refetching.
 */
export function subscribeToLocations(
  onData: (locations: CampusLocation[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(getFirestoreDb(), COLLECTIONS.locations));
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      onData(snapshot.docs.map((item) => normaliseLocation(item.id, item.data())));
    },
    (error) => onError(toFriendlyError(error)),
  );
}

/** Creates or replaces a location. */
export async function saveLocation(location: CampusLocation): Promise<void> {
  const errors = validateLocation(location);
  if (errors.length > 0) throw new Error(errors.join(' '));
  await setDoc(doc(getFirestoreDb(), COLLECTIONS.locations, location.id), toDocument(location), {
    merge: true,
  });
}

/**
 * Deactivates a location rather than deleting it.
 *
 * Hard-deleting a vertex would orphan every path that referenced it and silently
 * corrupt the graph. Deactivating removes it from routing while keeping the record
 * - and the administrator's ability to reactivate it - intact.
 */
export async function deactivateLocation(id: string): Promise<void> {
  await setDoc(
    doc(getFirestoreDb(), COLLECTIONS.locations, id),
    { isActive: false, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/** Reactivates a previously deactivated location. */
export async function reactivateLocation(id: string): Promise<void> {
  await setDoc(
    doc(getFirestoreDb(), COLLECTIONS.locations, id),
    { isActive: true, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/**
 * Permanently removes a location and every path that touched it.
 *
 * Offered only for locations with no inbound or outbound paths, or when an
 * administrator explicitly confirms the cascading delete.
 */
export async function deleteLocationCascade(id: string, edgeIds: string[]): Promise<void> {
  const batch = writeBatch(getFirestoreDb());
  batch.delete(doc(getFirestoreDb(), COLLECTIONS.locations, id));
  for (const edgeId of edgeIds) {
    batch.delete(doc(getFirestoreDb(), COLLECTIONS.edges, edgeId));
  }
  await batch.commit();
}

/** Removes a location outright. Prefer `deactivateLocation` in the UI. */
export async function deleteLocation(id: string): Promise<void> {
  await deleteDoc(doc(getFirestoreDb(), COLLECTIONS.locations, id));
}

/**
 * Turns an unknown Firestore error into a sentence an administrator can act on.
 */
export function toFriendlyError(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return new Error(
        'Firestore denied this request. Public visitors may read campus data but only a signed-in administrator may change it.',
      );
    case 'unavailable':
      return new Error('Firestore is unreachable right now. Check your connection and try again.');
    case 'failed-precondition':
      return new Error(
        'The Firestore database has not finished provisioning yet, or this query needs an index. Try again in a moment.',
      );
    case 'not-found':
      return new Error('That record no longer exists. Refresh and try again.');
    case 'unauthenticated':
    case 'auth/user-not-found':
      return new Error('You are signed out. Sign in as an administrator and retry.');
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}