/**
 * Authentication context.
 *
 * Holds the signed-in profile and the resolved `isAdmin` flag. Route guards and the
 * admin navigation both read from here, while Firestore Security Rules enforce the
 * same rule independently on the server side.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { observeAuth, refreshAdminStatus } from '@/services/auth';
import { isFirebaseConfigured } from '@/services/firebase';
import type { UserProfile } from '@/types/campus';

interface AuthValue {
  profile: UserProfile | null;
  /** True until the first auth-state callback has been received. */
  initialising: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True when the sign-in form should explain that Auth is not switched on. */
  authUnavailable: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setInitialising(false);
      return;
    }
    const unsubscribe = observeAuth((next) => {
      setProfile(next);
      setInitialising(false);
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setProfile(await refreshAdminStatus());
    } catch {
      /* keep the existing profile; the guard below still blocks the route */
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      profile,
      initialising,
      isAuthenticated: profile !== null,
      isAdmin: profile?.isAdmin === true,
      authUnavailable: !isFirebaseConfigured,
      refresh,
    }),
    [profile, initialising, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}