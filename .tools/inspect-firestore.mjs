/**
 * Inspects the existing Cloud Firestore structure of a Firebase project using the
 * Firestore REST API and the OAuth refresh token cached by the Firebase CLI.
 *
 * Usage: node .tools/inspect-firestore.mjs [projectId]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLIENT_ID =
  '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const CLIENT_SECRET = '9xZkVmT3qLu2WYxZyPMY2SyDGW3';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const projectId = process.argv[2] || 'cgci-campus-navigation';

function readTokens() {
  const storePath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const store = JSON.parse(readFileSync(storePath, 'utf8'));
  const tokens = store.tokens;
  if (tokens?.refresh_token) return tokens;
  const key = Object.keys(tokens || {}).find((k) => tokens[k]?.refresh_token);
  if (!key) throw new Error('No Firebase CLI refresh token found in configstore');
  return tokens[key];
}

async function accessToken() {
  const tokens = readTokens();
  const expiresAtSec = (tokens.expires_at ?? 0) / 1000;
  const stillValid = tokens.access_token && expiresAtSec - Date.now() / 1000 > 60;
  if (stillValid) return tokens.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(
      `token exchange failed: ${res.status} ${await res.text()}\n` +
        'Re-run `firebase login` to refresh the CLI session.',
    );
  }
  return (await res.json()).access_token;
}

function decodeDocId(name) {
  return name.split('/documents/')[1];
}

async function call(api, token, path, body) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${api}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const token = await accessToken();
const root = `projects/${projectId}/databases/(default)/documents`;

const cols = await call(
  `${root}:listCollectionIds`,
  token,
  root,
  { pageSize: 200 },
);
const collectionIds = cols.collectionIds || [];

if (collectionIds.length === 0) {
  console.log(`\nFirestore database "${projectId}" has NO top-level collections (empty database).\n`);
  process.exit(0);
}

console.log(`\n=== Firestore: ${projectId} ===`);
console.log(`Top-level collections (${collectionIds.length}): ${collectionIds.join(', ')}\n`);

for (const cid of collectionIds) {
  let count = 0;
  let pageToken;
  const sample = [];
  do {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (pageToken) qs.set('pageToken', pageToken);
    const out = await call(`${root}/${cid}?${qs}`, token, `${root}/${cid}`);
    for (const doc of out.documents || []) {
      count += 1;
      if (sample.length < 3) sample.push(doc);
    }
    pageToken = out.nextPageToken;
  } while (pageToken);

  console.log(`--- collection "${cid}" : ${count} document(s) ---`);
  for (const doc of sample) {
    console.log(`  doc ${decodeDocId(doc.name)}`);
    console.log(`  ${JSON.stringify(doc.fields, null, 2).split('\n').join('\n  ')}`);
  }
  console.log('');
}