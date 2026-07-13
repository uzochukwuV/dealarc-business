import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const backendRoot = process.cwd();
const serverCwd = backendRoot + '/artifacts/api-server';
const envText = await fs.readFile(backendRoot + '/.env', 'utf8');
const adminMatch = envText.match(/(?:^|\r?\n)ADMIN_USER_IDS=([^\r\n]+)/);
if (!adminMatch) throw new Error('ADMIN_USER_IDS missing from .env');
const adminUserId = adminMatch[1].split(',')[0].trim();
const port = '3037';
const baseUrl = 'http://127.0.0.1:' + port + '/api';
const sessionSecret = 'workspace-smoke-secret-' + crypto.randomBytes(8).toString('hex');

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
async function requestMaybe(pathname, options = {}) {
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
  return { ok: response.ok, status: response.status, data };
}
async function login(email, password) {
  return request('/auth/login', { method: 'POST', json: { email, password } });
}
function fd(fields, filename, content, type = 'text/plain') {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append('file', new Blob([content], { type }), filename);
  return form;
}

const backend = spawn('node', ['--env-file=../../.env', 'dist/index.mjs'], {
  cwd: serverCwd,
  env: { ...process.env, SESSION_SECRET: sessionSecret, PORT: port, PINATA_MOCK: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
backend.stdout.on('data', (d) => process.stdout.write(d));
backend.stderr.on('data', (d) => process.stderr.write(d));

try {
  await waitReady();
  const runId = 'b828b6cc';
  const buyer = await login(`workflow-smoke-${runId}-1@example.test`, 'WorkflowPass-1-2026');
  const seller = await login(`workflow-smoke-${runId}-2@example.test`, 'WorkflowPass-2-2026');

  const buyerOrgs = await request('/organizations', { token: buyer.token });
  const sellerOrgs = await request('/organizations', { token: seller.token });
  const buyerOrg = buyerOrgs.find((o) => o.legalName?.includes(runId) && o.publicProfile?.index === 1) ?? buyerOrgs[0];
  const sellerOrg = sellerOrgs.find((o) => o.legalName?.includes(runId) && o.publicProfile?.index === 2) ?? sellerOrgs[0];
  if (!buyerOrg?.id || !sellerOrg?.id) throw new Error('Could not resolve buyer/seller orgs');

  const connection = await request('/connections', {
    method: 'POST',
    token: buyer.token,
    json: {
      requestingOrgId: buyerOrg.id,
      targetOrgId: sellerOrg.id,
      reason: 'Workspace smoke',
      proposedDealCategory: 'Services',
      approxValue: '5',
      timeline: '7 days',
      requiresNda: true,
    },
  });

  const accepted = await request('/connections/' + connection.id + '/respond', {
    method: 'POST',
    token: seller.token,
    json: { response: 'ACCEPTED', createWorkspace: true },
  });
  const workspace = accepted.workspace;
  if (!workspace?.id) throw new Error('Workspace not created on connection accept');

  const requirement = await request('/workspaces/' + workspace.id + '/requirements', {
    method: 'POST',
    token: buyer.token,
    json: {
      createdByOrgId: buyerOrg.id,
      fields: {
        title: 'Website landing page',
        scope: 'Deliver a single responsive landing page and basic backend integration',
        deliverables: ['Landing page', 'Contact form', 'Deployment handoff'],
      },
    },
  });

  const proposal = await request('/workspaces/' + workspace.id + '/proposals', {
    method: 'POST',
    token: buyer.token,
    json: {
      proposedByOrgId: buyerOrg.id,
      requirementId: requirement.id,
      terms: {
        title: 'Website landing page escrow',
        currency: 'USDC',
        value: '5',
        milestones: [{ description: 'Initial delivery', amount: '5' }],
      },
    },
  });

  const sellerAcceptedProposal = await request('/workspaces/' + workspace.id + '/proposals/' + proposal.id + '/accept', {
    method: 'POST',
    token: seller.token,
    json: {},
  });
  const buyerAcceptedProposal = await request('/workspaces/' + workspace.id + '/proposals/' + proposal.id + '/accept', {
    method: 'POST',
    token: buyer.token,
    json: {},
  });

  const approvals = await request('/workspaces/' + workspace.id + '/approvals', { token: buyer.token });
  const buyerApproval = approvals.find((a) => a.organizationId === buyerOrg.id);
  const sellerApproval = approvals.find((a) => a.organizationId === sellerOrg.id);
  await request('/workspaces/' + workspace.id + '/approvals/' + buyerApproval.id + '/decide', {
    method: 'POST',
    token: buyer.token,
    json: { decision: 'APPROVED', notes: 'Buyer approved' },
  });
  await request('/workspaces/' + workspace.id + '/approvals/' + sellerApproval.id + '/decide', {
    method: 'POST',
    token: seller.token,
    json: { decision: 'APPROVED', notes: 'Seller approved' },
  });

  const agreement = await request('/workspaces/' + workspace.id + '/agreement', {
    method: 'POST',
    token: buyer.token,
    json: {},
  }).catch(async () => {
    const form = fd({ termSheetId: buyerAcceptedProposal.termSheetId ?? (await request('/workspaces/' + workspace.id + '/term-sheet', { token: buyer.token })).id }, 'agreement.txt', 'Workspace smoke agreement');
    const response = await fetch(baseUrl + '/workspaces/' + workspace.id + '/agreement', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + buyer.token },
      body: form,
    });
    const text = await response.text();
    if (!response.ok) throw new Error('agreement upload failed: ' + response.status + ' ' + text);
    return text ? JSON.parse(text) : null;
  });

  await request('/workspaces/' + workspace.id + '/agreement/sign', { method: 'POST', token: buyer.token, json: {} });
  await request('/workspaces/' + workspace.id + '/agreement/sign', { method: 'POST', token: seller.token, json: {} });

  const contract = await request('/workspaces/' + workspace.id + '/contract', {
    method: 'POST',
    token: buyer.token,
    json: { templateId: 'escrow-split-v1', chain: 'MATIC-AMOY' },
  });

  const funding = await request('/workspaces/' + workspace.id + '/fund', {
    method: 'POST',
    token: buyer.token,
    json: { amount: '5', currency: 'USDC', idempotencyKey: crypto.randomUUID() },
  });

  const start = await request('/workspaces/' + workspace.id + '/start', { method: 'POST', token: buyer.token, json: {} });
  const milestone = await request('/workspaces/' + workspace.id + '/milestones', {
    method: 'POST',
    token: buyer.token,
    json: { description: 'Initial delivery', amount: '5' },
  });

  const evidenceForm = fd({ evidenceType: 'DELIVERABLE', submittedByOrgId: buyerOrg.id, milestoneId: milestone.id }, 'evidence.txt', 'Delivered landing page assets');
  const evidenceResponse = await fetch(baseUrl + '/workspaces/' + workspace.id + '/evidence', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + buyer.token },
    body: evidenceForm,
  });
  const evidenceText = await evidenceResponse.text();
  if (!evidenceResponse.ok) throw new Error('evidence upload failed: ' + evidenceResponse.status + ' ' + evidenceText);
  const evidence = evidenceText ? JSON.parse(evidenceText) : null;

  const approveResult = await requestMaybe('/workspaces/' + workspace.id + '/milestones/' + milestone.id + '/approve', {
    method: 'POST',
    token: seller.token,
    json: {},
  });

  const settleResult = await requestMaybe('/workspaces/' + workspace.id + '/settle', {
    method: 'POST',
    token: buyer.token,
    json: { milestoneId: milestone.id, settlementStatus: 'COMPLETED' },
  });

  const finalWorkspace = await request('/workspaces/' + workspace.id + '/summary', { token: buyer.token }).catch(() => null);

  console.log(JSON.stringify({
    connectionId: connection.id,
    workspace,
    requirementId: requirement.id,
    proposalId: proposal.id,
    acceptedProposalId: sellerAcceptedProposal.id,
    agreementId: agreement?.id ?? null,
    contract,
    funding,
    start,
    milestone,
    evidence,
    milestoneApproval: approveResult,
    settle: settleResult,
    finalWorkspace,
  }, null, 2));
} finally {
  backend.kill('SIGTERM');
}




