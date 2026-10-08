/**
 * Firebase Authentication and the administrator check.
 *
 * Authorisation is an allowlist held in Firestore at `admins/{emailAddress}`: a
 * signed-in user is an administrator when their own record exists. Firestore
 * Security Rules enforce the same rule independently, and only an existing
 * administrator may add or remove records - so nobody can promote themselves.
 *
 * Hiding the admin menu in React is user-interface polish; the security rules are
 * the actual boundary.
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import type { UserProfile } from '@/types/campus';
import { COLLECTIONS, getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from './firebase';
import { toFriendlyError } from './locations';

/**
 * Checks the administrator allowlist for one email address.
 *
 * A `permission-denied` result means the record is absent, because the rules only
 * let a signed-in user read their own document. That is treated as "not an
 * administrator" rather than surfaced as an error, so an ordinary visitor simply
 * sees the public site.
 */
async function isAllowlistedAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const snapshot = await getDoc(doc(getFirestoreDb(), COLLECTIONS.admins, email));
    return snapshot.exists();
  } catch {
    return false;
  }
}

/** Builds a profile with the resolved administrator status. */
async function readProfile(user: User): Promise<UserProfile> {
  const email = user.email;
  return {
    uid: user.uid,
    email,
    displayName: user.displayName,
    isAdmin: await isAllowlistedAdmin(email),
  };
}

/** Signs in with email and password. Throws a human-readable error on failure. */
export async function signIn(email: string, password: string): Promise<UserProfile> {
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    return await readProfile(credential.user);
  } catch (error) {
    throw toFriendlyError(mapAuthError(error));
  }
}

/** Creates a new account. Public registration is optional in the login screen. */
export async function registerAccount(
  displayName: string,
  email: string,
  password: string,
): Promise<UserProfile> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
    return await readProfile(credential.user);
  } catch (error) {
    throw toFriendlyError(mapAuthError(error));
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  } catch (error) {
    throw toFriendlyError(mapAuthError(error));
  }
}

export async function logOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/**
 * Re-reads the allowlist for the current user.
 *
 * Used by the admin guard so a colleague who has just been granted access does not
 * have to sign out and back in before the dashboard opens.
 */
export async function refreshAdminStatus(): Promise<UserProfile | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return readProfile(user);
}

/**
 * Watches the authentication state.
 * Returns an unsubscribe function, or a no-op when Firebase is not configured so
 * the caller never has to guard the call site.
 */
export function observeAuth(onChange: (profile: UserProfile | null) => void): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onAuthStateChanged(getFirebaseAuth(), async (user) => {
    if (!user) {
      onChange(null);
      return;
    }
    try {
      onChange(await readProfile(user));
    } catch {
      onChange(null);
    }
  });
}

/** Converts raw auth error codes into sentences that say what to do next. */
function mapAuthError(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('That email and password combination was not recognised.');
    case 'auth/invalid-email':
      return new Error('That does not look like a valid email address.');
    case 'auth/user-disabled':
      return new Error('This account has been disabled. Contact the system administrator.');
    case 'auth/too-many-requests':
      return new Error('Too many failed attempts. Wait a minute before trying again.');
    case 'auth/email-already-in-use':
      return new Error('An account already exists for that email address.');
    case 'auth/weak-password':
      return new Error('Choose a password with at least six characters.');
    case 'auth/operation-not-allowed':
      return new Error(
        'Email and password sign-in is not enabled on this Firebase project. An administrator must turn it on under Authentication -> Sign-in method.',
      );
    case 'auth/network-request-failed':
      return new Error('Could not reach the authentication server. Check your connection.');
    case 'auth/configuration-not-found':
      return new Error(
        'Firebase Authentication has not been initialised for this project yet. Open the Firebase console and enable an email and password provider.',
      );
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}