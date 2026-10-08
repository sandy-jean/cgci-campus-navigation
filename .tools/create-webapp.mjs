/**
 * Creates a Firebase Web App for a project (if none exists) and prints its
 * client configuration so it can be placed in a local .env file.
 *
 * Usage: node .tools/create-webapp.mjs [projectId] [displayName]
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = process.argv[2] || 'cgci-campus-navigation';
const displayName = process.argv[3] || 'CGCI Campus Navigation';

const store = JSON.parse(
  readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'),
);
const token = store.tokens.access_token;

async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

const list = await call(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`);
let app = (list.apps || [])[0];

if (!app) {
  app = await call(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  console.log(`Created web app "${app.displayName}" (${app.appId})`);
} else {
  console.log(`Using existing web app "${app.displayName}" (${app.appId})`);
}

const c = app.webAppConfig;
const env = [
  `VITE_FIREBASE_API_KEY=${c.apiKey}`,
  `VITE_FIREBASE_AUTH_DOMAIN=${c.authDomain}`,
  `VITE_FIREBASE_PROJECT_ID=${c.projectId}`,
  `VITE_FIREBASE_STORAGE_BUCKET=${c.storageBucket}`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID=${c.messagingSenderId}`,
  `VITE_FIREBASE_APP_ID=${c.appId}`,
  `VITE_FIREBASE_MEASUREMENT_ID=${c.measurementId ?? ''}`,
  '',
].join('\n');

console.log('\n--- .env.local ---');
console.log(env);

if (!existsSync('.env.local')) writeFileSync('.env.local', env);
else console.log('(kept existing .env.local untouched)');