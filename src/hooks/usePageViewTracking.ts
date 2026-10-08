/**
 * Reports SPA navigations to Firebase Analytics.
 *
 * Firebase's automatic page_view only fires on full document loads, so a
 * single-page application must report client-side route changes itself. Mounted
 * once in the layout rather than in each page, which keeps the reporting in one
 * place and cannot be forgotten when a new route is added.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPageView } from '@/services/analytics';

const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, 'Campus Navigation'],
  [/^\/navigation/, 'Navigate'],
  [/^\/discrete-structures/, 'Discrete Structures'],
  [/^\/locations/, 'Campus Locations'],
  [/^\/admin/, 'Administration'],
  [/^\/login/, 'Sign in'],
];

function titleFor(pathname: string): string {
  for (const [pattern, title] of TITLES) if (pattern.test(pathname)) return title;
  return 'Campus Navigation';
}

export function usePageViewTracking() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    // React Router remounts on some transitions; only report genuine changes.
    if (previous.current === pathname) return;
    previous.current = pathname;
    void trackPageView(pathname, titleFor(pathname));
  }, [pathname]);
}