/**
 * Application root: providers and routing.
 *
 * The admin bundle is lazily loaded so a visitor who only wants directions never
 * downloads the dashboard. Every route is nested under AppLayout, so the header,
 * footer and page-view tracking are set up once.
 */

import { lazy, Suspense } from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { ErrorState } from '@/components/ui';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';
import { CampusDataProvider } from '@/context/CampusDataContext';
import { NavigatePage } from '@/pages/NavigatePage';
import { DiscreteStructuresPage } from '@/pages/DiscreteStructuresPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const AdminLayout = lazy(() =>
  import('@/pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })),
);
const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((module) => ({ default: module.AdminOverviewPage })),
);
const AdminLocationsPage = lazy(() =>
  import('@/pages/admin/AdminLocationsPage').then((module) => ({ default: module.AdminLocationsPage })),
);
const AdminPathsPage = lazy(() =>
  import('@/pages/admin/AdminPathsPage').then((module) => ({ default: module.AdminPathsPage })),
);
const AdminGraphPage = lazy(() =>
  import('@/pages/admin/AdminGraphPage').then((module) => ({ default: module.AdminGraphPage })),
);

/** Centred spinner for lazily loaded chunks. */
function RouteFallback() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center gap-2 text-sm text-ink-600">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      Loading…
    </div>
  );
}

/**
 * Global error boundary.
 *
 * React error boundaries must be class components. Without this, one unexpected
 * render error would blank the whole application; with it, the shell stays visible
 * and the visitor can still navigate away.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            title="The application hit an unexpected error"
            message={this.state.error.message || 'An unknown error occurred.'}
            action={
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="rounded-md bg-cgci-700 px-4 py-2 text-sm font-medium text-white hover:bg-cgci-800"
              >
                Return to campus navigation
              </button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CampusDataProvider>
            <ToastProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<NavigatePage />} />
                  <Route path="discrete-structures" element={<DiscreteStructuresPage />} />
                  <Route path="locations" element={<LocationsPage />} />
                  <Route path="login" element={<LoginPage />} />

                  <Route
                    path="admin"
                    element={
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    }
                  >
                    <Route
                      index
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AdminOverviewPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="locations"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AdminLocationsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="paths"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AdminPathsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="graph"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AdminGraphPage />
                        </Suspense>
                      }
                    />
                  </Route>

                  {/* Legacy/guessed admin paths land on the dashboard rather than a 404. */}
                  <Route path="admin/*" element={<Navigate to="/admin" replace />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ToastProvider>
          </CampusDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}