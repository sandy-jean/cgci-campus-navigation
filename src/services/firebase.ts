/**
 * Firebase initialisation.
 *
 * Everything the browser needs is read from Vite environment variables, so no
 * credential is hard-coded. Firebase Web configuration values are client-side
 * identifiers rather than secrets: the SDK requires them in the browser bundle,
 * and access is governed by Firestore Security Rules and API-key restrictions.
 * Service-account keys must never be imported here.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as analyticsSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

/**
 * True when every required variable is present.
 *
 * The app renders a configuration error screen instead of crashing on a blank
 * Firebase config, which is the difference between a clear fix (add the .env
 * values) and a blank page with a console stack trace.
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

export const firebaseConfig = config;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let analyticsInstance: Analytics | null = null;

/**
 * Firebase configuration problems, as user-facing sentences.
 * Surfaced by <ConfigGate /> rather than only in the console.
 */
export function configurationProblem(): string | null {
  if (isFirebaseConfigured) return null;
  const missing = Object.entries({
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_APP_ID: config.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length === 0) return null;
  return `Firebase is not configured. Missing: ${missing.join(', ')}. Copy .env.example to .env.local and restart the dev server.`;
}

/**
 * Lazily initialises Firebase.
 *
 * Initialisation is deferred rather than run at import time so that a missing
 * configuration produces a rendered error state instead of an unhandled throw
 * while the module graph is still loading.
 */
function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(configurationProblem() ?? 'Firebase is not configured.');
  }
  if (!app) app = initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function getFirestoreDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) storageInstance = getStorage(ensureApp());
  return storageInstance;
}

/**
 * Analytics is optional: it is skipped when the measurement id is absent, when
 * the browser blocks it (ad blockers, some privacy modes), or when the SDK reports
 * the environment as unsupported. Navigation must keep working regardless.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (!config.measurementId) return null;
  if (analyticsInstance) return analyticsInstance;
  try {
    if (!(await analyticsSupported())) return null;
    analyticsInstance = getAnalytics(ensureApp());
    return analyticsInstance;
  } catch {
    return null;
  }
}

/** Firestore collection names, kept in one place so the rules and the app agree. */
export const COLLECTIONS = {
  locations: 'locations',
  edges: 'edges',
  /** Campus-wide settings, e.g. the dataset provenance notice. */
  settings: 'settings',
  /**
   * Administrator allowlist. The document id is the administrator's email address,
   * which is what makes the security rule impossible to redirect at someone else.
   */
  admins: 'admins',
} as const;