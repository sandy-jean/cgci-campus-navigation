/**
 * Reports the Firebase Web App configuration and enabled identity providers for a
 * project, using the OAuth session cached by the Firebase CLI.
 *
 * Usage: node .tools/inspect-project.mjs [projectId]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = process.argv[2] || 'cgci-campus-navigation';

const store = JSON.parse(
  readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'),
);
const token = store.tokens.access_token;

async function get(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, json, text };
}

const apps = await get(
  `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
);
console.log(`=== WebApps (HTTP ${apps.status}) ===`);
if (apps.status === 200) {
  const list = apps.json.apps || [];
  console.log(`count: ${list.length}`);
  for (const app of list) {
    console.log(`\nappId: ${app.appId}`);
    console.log(`displayName: ${app.displayName}`);
    console.log('webAppConfig:');
    console.log(JSON.stringify(app.webAppConfig, null, 2));
  }
} else {
  console.log(apps.text.slice(0, 600));
}

const config = await get(
  `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config`,
);
console.log(`\n=== Identity Platform config (HTTP ${config.status}) ===`);
if (config.status === 200) {
  const providers = [];
  if (config.json.emailSignInConfig?.enabled) providers.push('password');
  if (config.json.signIn?.email?.enabled) providers.push('email');
  if (config.json.anonymousProviderConfig?.enabled) providers.push('anonymous');
  console.log(`signInProviders: ${JSON.stringify(config.json.signInProviders ?? {})}`);
  console.log(`allowDuplicateEmails: ${config.json.allowDuplicateEmails}`);
  console.log(`detected providers: ${providers.join(', ') || 'none enabled'}`);
} else {
  console.log(config.text.slice(0, 600));
}