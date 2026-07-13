import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const backendRoot = process.cwd();
const serverCwd = backendRoot + '/artifacts/api-server';
const envText = await fs.readFile(backendRoot + '/.env', 'utf8');
const adminMatch = envText.match(/(?:^|\r?\n)ADMIN_USER_IDS=([^\r\n]+)/);
if (!adminMatch) throw new Error('ADMIN_USER_IDS missing from .env');
const adminUserId = adminMatch[1].split(',')[0].trim();
const port = '3035';
const baseUrl = 'http://127.0.0.1:' + port + '/api';
const sessionSecret = 'smoke-session-secret-' + crypto.randomBytes(8).toString('hex');
const runId = crypto.randomUUID().slice(0, 8);
const entityMatch = envText.match(/(?:^|\r?\n)CIRCLE_ENTITY_SECRET=([^\r\n]+)/);
if (!entityMatch) throw new Error('CIRCLE_ENTITY_SECRET missing from .env');
const entitySecret = entityMatch[1].replace(/^"|"$/g, '');

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
async function request(pathname, options = {}) {
  const response = await fetch(baseUrl + pathname, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      ...(options.json ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.json ? JSON.stringify(options.json) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error((options.method ?? 'GET') + ' ' + pathname + ' failed: ' + response.status + ' ' + JSON.stringify(data));
  }
  return data;
}
async function seedBusinesses() {
  const businesses = [];
  for (const index of [1, 2]) {
    const email = 'workflow-smoke-' + runId + '-' + index + '@example.test';
    const password = 'WorkflowPass-' + index + '-2026';
    const name = 'Workflow Business ' + runId + ' ' + index;
    const tokenResponse = await request('/auth/register', { method: 'POST', json: { email, password, name } });
    const me = await request('/auth/me', { token: tokenResponse.token });
    const organization = await request('/organizations', {
      method: 'POST',
      token: tokenResponse.token,
      json: {
        legalName: 'Workflow Holdings ' + runId + ' ' + index,
        tradingName: 'Workflow ' + runId + ' ' + index,
        country: 'Nigeria',
        industry: 'Services',
        regionsServed: ['West Africa'],
        publicProfile: { stage: 'workflow-smoke', index },
      },
    });
    const verificationCase = await request('/organizations/' + organization.id + '/verification-cases', {
      method: 'POST',
      token: tokenResponse.token,
      json: {},
    });
    businesses.push({ token: tokenResponse.token, me, organization, verificationCase });
  }
  return businesses;
}

const adminToken = signJwt(adminUserId, 'admin@local.test');
let backend = spawn('node', ['--env-file=../../.env', 'dist/index.mjs'], {
  cwd: serverCwd,
  env: { ...process.env, SESSION_SECRET: sessionSecret, PORT: port, CIRCLE_ENTITY_SECRET: entitySecret },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
backend.stdout.on('data', (d) => process.stdout.write(d));
backend.stderr.on('data', (d) => process.stderr.write(d));

try {
  await waitReady();
  const setup = await request('/admin/setup/circle', { method: 'POST', token: adminToken, json: {} });
  const walletSetId = setup.walletSet?.id;
  if (!walletSetId) throw new Error('admin/setup/circle did not return walletSet.id');
  backend.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  backend = spawn('node', ['--env-file=../../.env', 'dist/index.mjs'], {
    cwd: serverCwd,
    env: { ...process.env, SESSION_SECRET: sessionSecret, PORT: port, CIRCLE_ENTITY_SECRET: entitySecret, CIRCLE_DEV_WALLET_SET_ID: walletSetId },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  backend.stdout.on('data', (d) => process.stdout.write(d));
  backend.stderr.on('data', (d) => process.stderr.write(d));
  await waitReady();

  const [buyer, seller] = await seedBusinesses();
  for (const business of [buyer, seller]) {
    await request('/admin/verification-cases/' + business.verificationCase.id + '/decide', {
      method: 'POST',
      token: adminToken,
      json: { decision: 'APPROVED', notes: 'Verified by live smoke' },
    });
  }

  const discovery = await request('/organizations?verifiedOnly=true&limit=20', { token: buyer.token });
  const discoveredIds = new Set((Array.isArray(discovery) ? discovery : []).map((o) => o.id));
  const buyerStats = await request('/organizations/' + buyer.organization.id + '/stats', { token: buyer.token });
  const sellerStats = await request('/organizations/' + seller.organization.id + '/stats', { token: buyer.token });

  console.log(JSON.stringify({
    setupWalletSetId: walletSetId,
    created: [buyer.organization, seller.organization].map((org, index) => ({
      id: org.id,
      legalName: org.legalName,
      walletProvisioned: org.provisioning?.walletProvisioned,
      identityRegistered: org.provisioning?.identityRegistered,
      blockchainAddress: org.provisioning?.blockchainAddress,
      onChainIdentityId: org.provisioning?.onChainIdentityId,
      errors: org.provisioning?.errors,
      authenticatedUser: [buyer, seller][index].me,
    })),
    discoveredBoth: [buyer.organization.id, seller.organization.id].every((id) => discoveredIds.has(id)),
    buyerStats,
    sellerStats,
  }, null, 2));
} finally {
  backend.kill('SIGTERM');
}
