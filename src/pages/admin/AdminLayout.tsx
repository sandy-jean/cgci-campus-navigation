/**
 * Admin dashboard shell.
 *
 * Tabs scroll horizontally on narrow screens rather than wrapping into an
 * unpredictable grid, and the tab strip is a real ARIA tablist so arrow keys work.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Network, Route, Building2, ChartNoAxesColumn } from 'lucide-react';

const TABS = [
  { to: '/admin', label: 'Overview', icon: ChartNoAxesColumn, end: true },
  { to: '/admin/locations', label: 'Locations', icon: Building2, end: false },
  { to: '/admin/paths', label: 'Paths', icon: Route, end: false },
  { to: '/admin/graph', label: 'Graph', icon: Network, end: false },
];

export function AdminLayout() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-ink-900">Administration</h1>
        <p className="mt-1 text-sm text-ink-600">
          Manage the vertices and edges of the campus graph. Changes appear on the
          public map immediately.
        </p>
      </div>

      <div className="mb-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <nav
          aria-label="Admin sections"
          role="tablist"
          className="inline-flex min-w-full gap-1 rounded-lg border border-ink-200 bg-white p-1"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              role="tab"
              aria-selected={undefined}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cgci-700 text-white'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`
              }
            >
              <tab.icon size={15} aria-hidden="true" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}