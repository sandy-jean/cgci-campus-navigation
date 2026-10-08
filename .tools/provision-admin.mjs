/**
 * One-time provisioning script for the CGCI Campus Navigation Firebase project.
 *
 * Two jobs:
 *   1. Creates the administrator's Firebase Authentication account if it is missing.
 *   2. Adds that email address to the `admins` allowlist in Firestore, which is what
 *      the security rules consult.
 *
 * It authenticates with the OAuth session cached by the Firebase CLI, so no
 * service-account key is ever required or stored.
 *
 * Usage:
 *   node .tools/provision-admin.mjs <email> [password]
 *
 * Requires: Firebase Authentication -> Email/Password enabled in the console.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = process.env.FIREBASE_PROJECT_ID || 'cgci-campus-navigation';
const email = process.argv[2];
const password = process.argv[3];

if (!email) {
  console.error('Usage: node .tools/provision-admin.mjs <email> [password]');
  console.error('  Omit the password to grant access to an account that already exists.');
  process.exit(1);
}

const store = JSON.parse(
  readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'),
);
const token = store.tokens.access_token;
const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: authHeader,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json, text };
}

const idToolkit = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;
const firestore = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

/* -------------------------------------------- 1. the Authentication account */

let uid;
const lookup = await call('POST', `${idToolkit}/accounts:lookup`, { email: [email] });

if (lookup.status === 200) {
  uid = lookup.json.users[0].localId;
  console.log(`Found existing account: ${email} (uid ${uid})`);
} else if (lookup.status === 400 && lookup.json?.error?.message?.includes('EMAIL_NOT_FOUND')) {
  if (!password) {
    console.error(`No account exists for ${email} and no password was supplied.`);
    process.exit(1);
  }
  const created = await call('POST', `${idToolkit}/accounts`, {
    email,
    password,
    emailVerified: true,
    displayName: 'CGCI Campus Administrator',
  });
  if (created.status !== 200) {
    console.error('Could not create the account:');
    console.error(JSON.stringify(created.json ?? created.text, null, 2));
    console.error('\nIf the message mentions OPERATION_NOT_ALLOWED or CONFIGURATION_NOT_FOUND,');
    console.error('enable Email/Password under Firebase console -> Authentication -> Sign-in method.');
    process.exit(1);
  }
  uid = created.json.localId;
  console.log(`Created account: ${email} (uid ${uid})`);
} else {
  console.error('Lookup failed:');
  console.error(JSON.stringify(lookup.json ?? lookup.text, null, 2));
  process.exit(1);
}

/* ------------------------------------------------ 2. the allowlist entry */

const entry = await call(
  'PATCH',
  // The document id is the email address, exactly as the security rule expects.
  `${firestore}/admins/${encodeURIComponent(email)}`,
  {
    fields: {
      email: { stringValue: email },
      uid: { stringValue: uid },
      role: { stringValue: 'admin' },
      grantedVia: { stringValue: '.tools/provision-admin.mjs' },
      updatedAt: { stringValue: new Date().toISOString() },
    },
  },
);

if (entry.status !== 200 && entry.status !== 201) {
  console.error('Could not write the allowlist entry:');
  console.error(JSON.stringify(entry.json ?? entry.text, null, 2));
  process.exit(1);
}

console.log(`Administrator allowlist updated: admins/${email}`);
console.log('\nSign in with this address to open the dashboard.');
console.log('Existing administrators can also add colleagues from Admin -> Overview.');