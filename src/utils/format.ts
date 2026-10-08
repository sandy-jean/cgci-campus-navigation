/**
 * Presentation helpers: distance, walking time, ids, and search matching.
 */

/**
 * Walking speed in metres per minute.
 *
 * 1.3 m/s is a comfortable outdoor walking pace for an adult on a level path
 * (about 4.7 km/h). Deliberately not a sprint: campus users carry bags and move
 * in groups, so an honest estimate is more useful than a fast one.
 */
export const WALKING_SPEED_M_PER_MIN = 78;

/** Formats metres for display, switching to kilometres past 1000 m. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 2 : 1)} km`;
}

/**
 * Estimates walking time in whole minutes, never rounding down to "0 min".
 */
export function walkingMinutes(metres: number): number {
  if (!Number.isFinite(metres) || metres <= 0) return 0;
  return Math.max(1, Math.round(metres / WALKING_SPEED_M_PER_MIN));
}

/** "3 min" / "1 hr 5 min" / "under a minute" */
export function formatDuration(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  const minutes = walkingMinutes(metres);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * Converts a name into a stable, readable id: "Science Laboratory" -> "science-laboratory".
 *
 * Ids become Firestore document names and URL fragments, so they must contain no
 * spaces, slashes, or characters Firestore rejects.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Joins array items into "a, b and c". */
export function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return '—';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Formats a Firestore timestamp (ISO string, Date, or epoch millis) as a date. */
export function formatDate(value: unknown): string {
  if (!value) return '—';
  const date =
    value instanceof Date
      ? value
      : typeof value === 'object' && value && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Scores a location against a search query.
 *
 * Higher is better; 0 means no match. Ranking is deliberate so that typing
 * "lib" puts the Library above a building that merely mentions "library" in its
 * description:
 *
 *   12  exact name match
 *   10  name starts with the query
 *    8  name contains the query
 *    5  a keyword matches
 *    3  type or category matches
 *    1  description or facility mentions it
 */
export function searchScore(location: CampusLocationLike, query: string): number {
  const term = query.trim().toLowerCase();
  if (!term) return 1;

  const name = location.name.toLowerCase();
  if (name === term) return 12;
  if (name.startsWith(term)) return 10;
  if (name.includes(term)) return 8;
  const keywords = location.keywords ?? [];
  if (keywords.some((word) => word === term)) return 6;
  if (keywords.some((word) => word.includes(term))) return 5;
  if (`${location.type ?? ''} ${location.category ?? ''}`.toLowerCase().includes(term)) return 3;
  const haystack = `${location.description ?? ''} ${(location.facilities ?? []).join(' ')}`.toLowerCase();
  if (haystack.includes(term)) return 1;
  return 0;
}

/**
 * The subset of a location that search needs. Kept structurally minimal so any
 * location-like object can be searched without conversion.
 */
export interface CampusLocationLike {
  name: string;
  type?: string;
  category?: string;
  description?: string;
  keywords?: string[];
  facilities?: string[];
}

/**
 * Ranks locations for a query. Inactive locations are excluded by the caller, not
 * here, so the admin tables can search them too.
 */
export function rankLocations<T extends CampusLocationLike>(
  locations: T[],
  query: string,
  limit = 8,
): T[] {
  if (!query.trim()) return locations.slice(0, limit);
  return locations
    .map((location) => ({ location, score: searchScore(location, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name))
    .slice(0, limit)
    .map((entry) => entry.location);
}