/**
 * Application shell: skip link, header, routed content, footer.
 *
 * Responsive strategy
 * -------------------
 * The shell is a full-height flex column. On mobile the page scrolls normally and
 * content sizes itself; from `lg` up the shell becomes a fixed-height column with
 * an independently scrolling main region, so the map fills the viewport instead of
 * growing the page past the fold.
 *
 * The whole layout is mobile-first: single column by default, two columns at `md`,
 * three at `xl`. No fixed pixel widths are used anywhere, so nothing can overflow
 * horizontally.
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, ShieldCheck, X } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useCampusData } from '@/context/CampusDataContext';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';

const NAV_ITEMS = [
  { to: '/', label: 'Navigate', end: true },
  { to: '/discrete-structures', label: 'Discrete Structures' },
  { to: '/locations', label: 'Campus Locations' },
];

export function AppLayout() {
  usePageViewTracking();
  const { isAdmin, isAuthenticated, profile } = useAuth();
  const { status, hasProvisionalData } = useCampusData();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-ink-100">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 shrink-0 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 rounded py-1 text-ink-900"
            onClick={() => setMenuOpen(false)}
          >
            <img
              src="/cgci-logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-md sm:h-10 sm:w-10"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-semibold sm:text-base">
                CGCI Campus Navigation
              </span>
              <span className="block truncate text-[11px] leading-tight text-ink-500 sm:text-xs">
                Core Gateway College
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cgci-50 text-cgci-800'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:inline-flex ${
                    isActive
                      ? 'bg-cgci-700 text-white'
                      : 'border border-ink-300 text-ink-700 hover:bg-ink-50'
                  }`
                }
              >
                <ShieldCheck size={16} aria-hidden="true" />
                Admin
              </NavLink>
            )}

            <div className="hidden lg:block">
              {isAuthenticated ? (
                <span
                  className="max-w-[180px] truncate text-xs text-ink-500"
                  title={profile?.email ?? undefined}
                >
                  {profile?.email}
                </span>
              ) : (
                <Link
                  to="/login"
                  state={{ from: location.pathname }}
                  className="rounded-md border border-ink-300 px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
                >
                  Sign in
                </Link>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-md p-2 text-ink-700 transition hover:bg-ink-100 md:hidden"
            >
              {menuOpen ? <Menu size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {menuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="border-t border-ink-200 bg-white px-4 py-3 md:hidden"
          >
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-cgci-50 text-cgci-800' : 'text-ink-700 hover:bg-ink-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {isAdmin && (
                <li>
                  <NavLink
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-cgci-800 hover:bg-cgci-50"
                  >
                    <ShieldCheck size={16} aria-hidden="true" /> Administration
                  </NavLink>
                </li>
              )}
              <li className="pt-1">
                <NavLink
                  to={isAuthenticated ? '/admin' : '/login'}
                  state={{ from: location.pathname }}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md border border-ink-300 px-3 py-2.5 text-center text-sm font-medium text-ink-800"
                >
                  {isAuthenticated ? 'Go to dashboard' : 'Administrator sign in'}
                </NavLink>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {hasProvisionalData && status === 'ready' && <ProvisionalBanner />}

      <main id="main" className="min-h-0 flex-1">
        <Outlet />
      </main>

      <footer className="shrink-0 border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-4 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            CGCI Campus Navigation — a Discrete Structures 1 project on graph theory,
            reachability and shortest paths.
            <span className="mt-0.5 block sm:mt-0 sm:ml-1 sm:inline">
              Developed by Sandy Gabitanan and Chynna Madriaga.
            </span>
          </p>
          <p className="sm:text-right">
            Routes are estimates for guidance, not official wayfinding.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Persistent notice about the three buildings the college has not yet named.
 *
 * The official CGCI campus site map still labels these three structures
 * "BLDG. NAME". The system names them by their documented contents so they can be
 * routed to at all, and this banner says so rather than presenting those names as
 * official. It disappears once an administrator confirms the real names.
 */
function ProvisionalBanner() {
  return (
    <div className="border-b border-amber-200 bg-route-50">
      <div className="mx-auto flex max-w-[1600px] items-start gap-2 px-4 py-2.5 text-xs text-ink-700 sm:px-6">
        <span aria-hidden="true" className="mt-px shrink-0 font-semibold text-route-600">
          !
        </span>
        <p className="leading-relaxed">
          <span className="font-semibold">Three buildings are still unnamed.</span> The
          official CGCI campus site map labels the clinic building, the student
          affairs building and the senior high school building simply{' '}
          <span className="font-medium">“BLDG. NAME”</span>. This system labels them
          by their documented contents so they can be navigated to, but those names
          are not official. An administrator can correct them from{' '}
          <Link to="/admin/locations" className="underline underline-offset-2">
            Campus locations
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={(event) => event.currentTarget.closest('div')?.parentElement?.remove()}
          aria-label="Dismiss notice"
          className="ml-auto shrink-0 rounded p-0.5 text-ink-400 hover:text-ink-700"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}