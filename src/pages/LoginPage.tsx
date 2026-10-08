/**
 * Administrator sign-in.
 *
 * Two modes share one screen: sign in, and create an account. Registration is only
 * useful here once an administrator has granted the `admin` claim to that address,
 * and the screen says so — otherwise a visitor might create an account expecting
 * access and find none.
 *
 * This component decides nothing about authorisation. It reports whether the signed
 * in profile carries the admin claim; Firestore Security Rules enforce the same
 * rule independently.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, ShieldCheck, TriangleAlert, UserPlus } from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { TextField } from '@/components/ui/forms';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/services/analytics';
import { logOut, registerAccount, resetPassword, signIn } from '@/services/auth';

type Mode = 'signin' | 'register';

export function LoginPage() {
  const { isAdmin, isAuthenticated, authUnavailable, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  // An administrator who is already signed in has no business on this page.
  useEffect(() => {
    if (isAdmin) navigate(from, { replace: true });
  }, [isAdmin, from, navigate]);

  if (isAdmin) return <Navigate to={from} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError('Enter your email address.');
    if (password.length < 6) return setError('Enter your password (at least six characters).');

    setBusy(true);
    try {
      if (mode === 'signin') {
        const next = await signIn(email, password);
        if (!next.isAdmin) {
          // Signed in, but without the claim. Sign out again rather than leaving a
          // half-authenticated session in place.
          await logOut();
          void trackEvent('admin_sign_in_failed', {});
          setError(
            'You are signed in, but this email address is not on the administrator list. Ask an existing administrator to add it from Admin -> Overview.',
          );
          return;
        }
        void trackEvent('admin_signed_in', {});
        navigate(from, { replace: true });
      } else {
        await registerAccount(displayName, email, password);
        setNotice(
          'Account created. It still needs administrator permission: an existing administrator must add this email address to the administrator list before the dashboard will open.',
        );
        setMode('signin');
      }
    } catch (err) {
      void trackEvent('admin_sign_in_failed', {});
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then choose “Forgot password”.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setNotice(`If an account exists for ${email.trim()}, a password reset link is on its way.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-cgci-700 text-white">
          <ShieldCheck size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-2xl font-semibold text-ink-900">Administrator access</h1>
        <p className="mt-1 text-sm text-ink-600">
          Manage campus buildings, walking paths and graph data.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        {authUnavailable && (
          <div className="mb-4 rounded-md border border-route-100 bg-route-50 px-3 py-2.5 text-sm text-ink-800">
            Firebase is not configured, so sign-in is unavailable. Copy{' '}
            <code className="rounded bg-white px-1">.env.example</code> to{' '}
            <code className="rounded bg-white px-1">.env.local</code> and restart the
            dev server.
          </div>
        )}

        <div
          className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-ink-100 p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          {(['signin', 'register'] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className={`rounded px-3 py-2 text-sm font-medium transition ${
                mode === value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {value === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          {mode === 'register' && (
            <TextField
              label="Full name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              placeholder="Your name"
            />
          )}

          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {notice && (
            <p role="status" className="rounded-md border border-cgci-200 bg-cgci-50 px-3 py-2 text-sm text-cgci-900">
              {notice}
            </p>
          )}

          <Button type="submit" fullWidth disabled={busy}>
            {mode === 'signin' ? (
              <>
                <LogIn size={16} aria-hidden="true" />
                {busy ? 'Signing in…' : 'Sign in'}
              </>
            ) : (
              <>
                <UserPlus size={16} aria-hidden="true" />
                {busy ? 'Creating…' : 'Create account'}
              </>
            )}
          </Button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={forgot}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-cgci-700 transition hover:underline disabled:opacity-50"
            >
              <KeyRound size={14} aria-hidden="true" />
              Forgot password
            </button>
          )}
        </form>
      </Card>

      {isAuthenticated && !isAdmin && (
        <Card className="mt-4 p-4 text-sm">
          <p className="text-ink-700">
            Currently signed in as <strong>{profile?.email}</strong>, without
            administrator permission.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void logOut()}
          >
            Sign out
          </Button>
        </Card>
      )}

      <p className="mt-6 text-center text-sm text-ink-600">
        <Link to="/" className="font-medium text-cgci-700 underline underline-offset-2">
          Back to campus navigation
        </Link>
      </p>
    </div>
  );
}