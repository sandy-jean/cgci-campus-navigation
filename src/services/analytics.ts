/**
 * Firebase Analytics wrapper.
 *
 * Privacy rules applied here:
 *   - No email addresses, user ids, or any other personal data are ever sent.
 *   - Campus locations are referenced by their opaque document id, never by name,
 *     so analytics cannot leak the movements of an individual student.
 *   - Every call is fire-and-forget and swallows its own errors: a blocked or
 *     unavailable analytics pipeline must never interrupt navigation.
 *
 * Events are declared once as a typed map so a typo becomes a compile error
 * rather than a silently missing metric in the report.
 */

import { getFirebaseAnalytics } from './firebase';

type EventParams = Record<string, string | number | boolean | undefined>;

interface EventMap {
  /** Reported by the router rather than declared as a custom event. */
  page_view: { page_path: string; page_title: string };
  location_search: { termLength: number; resultCount: number };
  location_selected: { locationId: string; source: 'search' | 'map' | 'list' | 'route' };
  building_viewed: { locationId: string };
  route_requested: { origin: string; destination: string; algorithm: string };
  route_completed: {
    origin: string;
    destination: string;
    algorithm: string;
    distance: number;
    hops: number;
  };
  route_unavailable: { origin: string; destination: string; algorithm: string };
  navigation_started: { origin: string; destination: string };
  navigation_reset: Record<string, never>;
  location_created: { category: string };
  location_updated: { category: string };
  location_deactivated: Record<string, never>;
  edge_created: { distance: number };
  edge_updated: Record<string, never>;
  edge_deleted: Record<string, never>;
  admin_signed_in: Record<string, never>;
  admin_sign_in_failed: Record<string, never>;
}

export type AnalyticsEventName = keyof EventMap;

/**
 * Drops undefined values so they are not sent as the string "undefined",
 * then records the event.
 */
export async function trackEvent<K extends AnalyticsEventName>(
  name: K,
  params: EventMap[K],
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    const { logEvent } = await import('firebase/analytics');
    const clean: EventParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) clean[key] = value;
    }
    // Cast once at the boundary: the SDK's `CustomEventName` helper cannot express
    // that one of our names (`page_view`) is a GA4 reserved event rather than a
    // custom one, which makes the generic relationship unrepresentable in types.
    logEvent(analytics, name as string, clean);
  } catch {
    /* Analytics must never surface an error to the user. */
  }
}

/**
 * Records a SPA page view.
 *
 * Firebase's automatic page_view tracking does not fire for client-side route
 * changes, so the router reports them here instead.
 */
export async function trackPageView(pagePath: string, pageTitle: string): Promise<void> {
  await trackEvent('page_view', { page_path: pagePath, page_title: pageTitle });
}

/**
 * Event names rendered on the admin analytics page, with the explanation shown
 * beside each one. Keeping the copy in code avoids a second source of truth.
 */
export const EVENT_DOCUMENTATION: Array<{ name: AnalyticsEventName; purpose: string }> = [
  { name: 'page_view', purpose: 'A route was opened (reported by the SPA router).' },
  { name: 'location_search', purpose: 'A visitor searched the campus location list.' },
  { name: 'location_selected', purpose: 'A building was chosen from search, the map, or a route.' },
  { name: 'building_viewed', purpose: 'The details panel for a building was opened.' },
  { name: 'route_requested', purpose: 'A shortest-path calculation was requested.' },
  { name: 'route_completed', purpose: 'A route was found and drawn, with its distance.' },
  { name: 'route_unavailable', purpose: 'No path exists between the two chosen locations.' },
  { name: 'navigation_started', purpose: 'An origin and destination were both chosen.' },
  { name: 'navigation_reset', purpose: 'The visitor cleared the active route.' },
  { name: 'location_created', purpose: 'An administrator added a building.' },
  { name: 'location_updated', purpose: 'An administrator edited a building.' },
  { name: 'location_deactivated', purpose: 'An administrator took a building out of service.' },
  { name: 'edge_created', purpose: 'An administrator connected two buildings.' },
  { name: 'edge_updated', purpose: 'An administrator changed a path or reopened a closed one.' },
  { name: 'edge_deleted', purpose: 'An administrator removed a path.' },
  { name: 'admin_signed_in', purpose: 'An administrator authenticated.' },
  { name: 'admin_sign_in_failed', purpose: 'A rejected administrator sign-in attempt.' },
];