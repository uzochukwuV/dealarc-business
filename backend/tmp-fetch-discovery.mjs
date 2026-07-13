import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const backendRoot = process.cwd();
const serverCwd = backendRoot + '/artifacts/api-server';
const envText = await fs.readFile(backendRoot + '/.env', 'utf8');
const adminMatch = envText.match(/(?:^|\r?\n)ADMIN_USER_IDS=([^\r\n]+)/);
if (!adminMatch) throw new Error('ADMIN_USER_IDS missing from .env');
const adminUserId = adminMatch[1].split(',')[0].trim();
const port = '3036';
const baseUrl = 'http://127.0.0.1:' + port + '/api';
const sessionSecret = 'discovery-secret-' + crypto.randomBytes(8).toString('hex');

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function signJwt(sub, email) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, email, iat: now, exp: now + 7 * 24 * 60 * 60 }));
  const signingInput = header + '.' + payload;
  const sig = b64url(crypto.createHmac('sha256', sessionSecret).update(signingInput).digest());
  return signingInput + '.' + sig;
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(baseUrl + '/healthz');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('backend did not become ready');
}

async function request(pathname, token) {
  const response = await fetch(baseUrl + pathname, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error('GET ' + pathname + ' failed: ' + response.status + ' ' + JSON.stringify(data));
  }
  return data;
}

const backend = spawn('node', ['--env-file=../../.env', 'dist/index.mjs'], {
  cwd: serverCwd,
  env: { ...process.env, SESSION_SECRET: sessionSecret, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
backend.stdout.on('data', (d) => process.stdout.write(d));
backend.stderr.on('data', (d) => process.stderr.write(d));

try {
  await waitReady();
  const adminToken = signJwt(adminUserId, 'admin@local.test');
  const discovery = await request('/organizations?verifiedOnly=true&limit=20', adminToken);
  console.log(JSON.stringify(discovery, null, 2));
} finally {
  backend.kill('SIGTERM');
}
