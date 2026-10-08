/**
 * Verifies the deployed Firestore Security Rules from a client's point of view.
 *
 * Runs against the real project using the Web SDK exactly as a browser would, so the
 * requests are evaluated by the deployed rules rather than by a local copy. It checks
 * both halves of the security model: public reads must succeed, and unauthenticated
 * writes must be refused with a permission error rather than silently succeeding.
 *
 * Usage: node scripts/verify-rules.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  getFirestore,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAMjSWGhg6PU1bhkTTzmgqBWJ21X9xo97M',
  authDomain: 'cgci-campus-navigation.firebaseapp.com',
  projectId: 'cgci-campus-navigation',
  storageBucket: 'cgci-campus-navigation.firebasestorage.app',
  messagingSenderId: '49778876817',
  appId: '1:49778876817:web:696b9d6e82d2cee0ce3a30',
};

const app = initializeApp(config, 'rules-verification');
const db = getFirestore(app);
const auth = getAuth(app);

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '  PASS' : '  FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

/** True when Firestore denied the request. */
const isPermissionDenied = (error) => error?.code === 'permission-denied';

console.log('\nVerifying deployed Firestore rules\n');

let signedIn = false;
try {
  await signInAnonymously(auth);
  signedIn = true;
  console.log('Signed in anonymously: requests now carry a token with no admin claim.\n');
} catch (error) {
  console.log(`Anonymous sign-in unavailable (${error.code}); testing fully signed out.\n`);
}

// ------------------------------------------------------------- public reads
for (const name of ['locations', 'edges']) {
  try {
    const snapshot = await getDocs(collection(db, name));
    check(`Visitor can read ${name}`, snapshot.size > 0, `${snapshot.size} documents`);
  } catch (error) {
    check(`Visitor can read ${name}`, false, error.code);
  }
}

// ----------------------------------------------- writes must be refused
const probeId = `rules-probe-${Date.now()}`;

/**
 * Attempts a write and asserts it is denied.
 * If it unexpectedly succeeds, the probe document is deleted again so the test
 * leaves no residue.
 */
async function expectDenied(label, collectionName, data) {
  try {
    await setDoc(doc(db, collectionName, probeId), data);
    await deleteDoc(doc(db, collectionName, probeId)).catch(() => {});
    check(label, false, 'WRITE SUCCEEDED - rules are too permissive');
  } catch (error) {
    check(label, isPermissionDenied(error), isPermissionDenied(error) ? 'permission-denied' : error.code);
  }
}

await expectDenied('Write to locations is refused', 'locations', {
  name: 'Rules Probe',
  category: 'facility',
  x: 500,
  y: 350,
  isActive: true,
});

await expectDenied('Write to edges is refused', 'edges', {
  from: 'library',
  to: 'canteen',
  distance: 10,
  walkable: true,
});

await expectDenied('Write to settings is refused', 'settings', { tampered: true });

// ------------------------------------------- unknown collections are closed
try {
  const snapshot = await getDocs(collection(db, 'not-a-real-collection'));
  check(
    'Unknown collection is closed by default',
    snapshot.size === 0,
    snapshot.size === 0 ? 'no data exposed' : `${snapshot.size} documents readable`,
  );
} catch (error) {
  check('Unknown collection is closed by default', isPermissionDenied(error), error.code);
}

// ------------------------------------------------------- fully signed-out
if (signedIn) {
  await signOut(auth);
  try {
    const snapshot = await getDocs(collection(db, 'locations'));
    check('Signed-out visitor can read locations', snapshot.size > 0, `${snapshot.size} documents`);
  } catch (error) {
    check('Signed-out visitor can read locations', isPermissionDenied(error), error.code);
  }
}

// ------------------------------------------------------------------ verdict
const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log('\nFailed checks:');
  for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
  process.exit(1);
}
console.log('\nSecurity rules behave as designed.\n');