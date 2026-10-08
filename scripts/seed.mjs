/**
 * Seeds the Firestore database with the CGCI campus dataset transcribed from the
 * official campus site map.
 *
 * Safe by design:
 *   - `SEED_MODE=overwrite` is required before any existing document is replaced;
 *     the default (`skip`) leaves anything already in Firestore untouched.
 *   - Nothing is deleted automatically. Pass `SEED_PRUNE=1` to remove documents that
 *     are no longer part of the dataset (for example when replacing an earlier
 *     layout). Pruning is opt-in and prints exactly what it would remove first.
 *
 * Usage:
 *   npm run seed                                  # add only missing documents
 *   SEED_MODE=overwrite npm run seed              # update existing documents
 *   SEED_MODE=overwrite SEED_PRUNE=1 npm run seed # also remove stale documents
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectId = process.env.FIREBASE_PROJECT_ID || 'cgci-campus-navigation';
const mode = process.env.SEED_MODE || 'skip';
const prune = process.env.SEED_PRUNE === '1';

if (!['skip', 'overwrite'].includes(mode)) {
  console.error(`Unknown SEED_MODE "${mode}". Use "skip" or "overwrite".`);
  process.exit(1);
}

const dataset = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'campusLayout.json'), 'utf8'));

const store = JSON.parse(
  readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'),
);
const token = store.tokens.access_token;
const root = `projects/${projectId}/databases/(default)/documents`;

async function call(path, init = {}) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}\n${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function exists(name) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

async function listIds(collection) {
  const ids = [];
  let pageToken;
  do {
    // `mask.fieldPaths=name` asks Firestore for document names only, which is all
    // the pruning step needs and keeps the response small.
    const query = new URLSearchParams({ pageSize: '300', 'mask.fieldPaths': 'name' });
    if (pageToken) query.set('pageToken', pageToken);
    const out = await call(`${root}/${collection}?${query}`);
    for (const doc of out.documents ?? []) ids.push(doc.name.split('/').pop());
    pageToken = out.nextPageToken;
  } while (pageToken);
  return ids;
}

function typed(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = { arrayValue: { values: value.map((v) => ({ stringValue: String(v) })) } };
    } else if (typeof value === 'boolean') out[key] = { booleanValue: value };
    else if (typeof value === 'number') out[key] = { doubleValue: value };
    else out[key] = { stringValue: String(value) };
  }
  return out;
}

async function write(collection, id, fields) {
  const mask = Object.keys(fields)
    .map((key) => `updateMask.fieldPaths=${key}`)
    .join('&');
  await call(`${root}/${collection}/${id}?${mask}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: typed(fields) }),
  });
}

async function remove(collection, id) {
  await call(`${root}/${collection}/${id}`, { method: 'DELETE' });
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const [collection, records] of [
  ['locations', dataset.locations],
  ['edges', dataset.edges],
]) {
  for (const record of records) {
    const name = `${root}/${collection}/${record.id}`;
    const already = await exists(name);
    if (already && mode === 'skip') {
      skipped += 1;
      continue;
    }
    const { id, ...fields } = record;
    await write(collection, id, fields);
    already ? (updated += 1) : (created += 1);
  }
}

await write('settings', 'dataset', {
  version: dataset.meta.datasetVersion,
  source: dataset.meta.source,
  provenance: dataset.meta.provenance,
  notice: dataset.meta.notice,
  notes: dataset.meta.notes,
  seededAt: new Date().toISOString(),
});

let pruned = 0;
if (prune) {
  console.log('\nPruning documents that are no longer part of the dataset:');
  for (const [collection, records] of [
    ['locations', dataset.locations],
    ['edges', dataset.edges],
  ]) {
    const wanted = new Set(records.map((record) => record.id));
    for (const id of await listIds(collection)) {
      if (wanted.has(id)) continue;
      if (mode !== 'overwrite') {
        console.log(`  SKIP   ${collection}/${id}  (SEED_MODE=overwrite required to remove)`);
        continue;
      }
      await remove(collection, id);
      pruned += 1;
      console.log(`  REMOVE ${collection}/${id}`);
    }
  }
}

console.log(`\nSeed complete (mode: ${mode}${prune ? ', prune' : ''})`);
console.log(`  created : ${created}`);
console.log(`  updated : ${updated}`);
console.log(`  untouched: ${skipped}`);
if (prune) console.log(`  pruned  : ${pruned}`);

const unverified = dataset.locations.filter((location) => !location.verified);
console.log(`\nSource: ${dataset.meta.source}`);
console.log(`${unverified.length} building(s) are still "BLDG. NAME" on the official map:`);
for (const location of unverified) console.log(`  - ${location.name} (${location.id})`);