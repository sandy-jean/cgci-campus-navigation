/**
 * Route guards for the admin area.
 *
 * `RequireAdmin` performs three checks in order: Firebase must be configured, the
 * visitor must be signed in, and their email address must be on the administrator
 * allowlist. It renders an explanation rather than silently redirecting, so someone
 * who is signed in without access understands why they are blocked.
 *
 * The client-side check exists only so the interface can adapt. Firestore Security
 * Rules reject unauthorised writes independently of anything rendered here.
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, initialising, authUnavailable, refresh, profile } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-sm text-ink-600">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Checking administrator permissions…
      </div>
    );
  }

  if (authUnavailable) {
    return (
      <Blocked
        title="Firebase is not configured"
        message="The admin dashboard cannot verify permissions without Firebase. Copy .env.example to .env.local and restart the dev server."
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return (
      <Blocked
        title="Administrator permission required"
        message={`You are signed in as ${profile?.email ?? 'this account'}, but it is not on the administrator list. An existing administrator can add this email address from Admin -> Overview, after which the button below will pick it up without signing out.`}
      >
        <Button onClick={() => void refresh()}>Check again</Button>
      </Blocked>
    );
  }

  return <>{children}</>;
}

function Blocked({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card className="p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{message}</p>
        {children && <div className="mt-5 flex justify-center">{children}</div>}
        <p className="mt-4 text-sm">
          <a href="/" className="font-medium text-cgci-700 underline underline-offset-2">
            Return to campus navigation
          </a>
        </p>
      </Card>
    </div>
  );
}