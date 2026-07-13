import assert from "node:assert/strict";
import crypto from "node:crypto";

let baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000/api";
if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
const adminToken = process.env.ADMIN_BEARER_TOKEN;
const templateId = process.env.WORKFLOW_TEMPLATE_ID ?? "escrow-split-v1";

if (!adminToken) {
  throw new Error("ADMIN_BEARER_TOKEN is required so the smoke test can approve verification cases");
}

async function request(pathname, options = {}) {
  const method = options.method ?? "GET";
  const token = options.token;
  const body = options.body;

  const headers = {
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(baseUrl + pathname, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(method + " " + pathname + " failed: " + response.status + " " + JSON.stringify(data));
  }

  return data;
}

async function registerBusiness(index) {
  const email = "workflow-smoke-" + index + "@example.test";
  const password = "WorkflowPass-" + index + "-2026";
  const name = "Workflow Business " + index;
  const tokenResponse = await request("/auth/register", {
    method: "POST",
    body: { email, password, name },
  });

  const organization = await request("/organizations", {
    method: "POST",
    token: tokenResponse.token,
    body: {
      legalName: "Workflow Holdings " + index,
      tradingName: "Workflow " + index,
      country: "Nigeria",
      industry: "Services",
      regionsServed: ["West Africa"],
      publicProfile: { stage: "workflow-smoke", index },
    },
  });

  assert.equal(organization.provisioning.walletProvisioned, true, "Circle wallet should be created");
  assert.equal(organization.provisioning.identityRegistered, true, "On-chain identity should be created");
  assert.ok(organization.provisioning.circleWalletId, "Circle wallet id is required");
  assert.ok(organization.provisioning.blockchainAddress, "Blockchain address is required");
  assert.equal((organization.provisioning.errors ?? []).length, 0, "Org provisioning should be clean");

  const verificationCase = await request("/organizations/" + organization.id + "/verification-cases", {
    method: "POST",
    token: tokenResponse.token,
    body: {},
  });

  return { token: tokenResponse.token, organization, verificationCase };
}

function makeFormData(fields, filename, fileContents) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  form.append("file", new Blob([fileContents], { type: "application/octet-stream" }), filename);
  return form;
}

const [buyer, seller] = [await registerBusiness(1), await registerBusiness(2)];

for (const business of [buyer, seller]) {
  await request("/admin/verification-cases/" + business.verificationCase.id + "/decide", {
    method: "POST",
    token: adminToken,
    body: { decision: "APPROVED", notes: "Verified by workflow smoke" },
  });
}

const discoveredOrganizations = await request("/organizations?verifiedOnly=true&limit=20", {
  token: buyer.token,
});
assert.ok(Array.isArray(discoveredOrganizations), "Discovery response should be an array");
assert.ok(
  discoveredOrganizations.some((org) => org.id === buyer.organization.id),
  "Buyer org should be discoverable after verification",
);
assert.ok(
  discoveredOrganizations.some((org) => org.id === seller.organization.id),
  "Seller org should be discoverable after verification",
);

const connection = await request("/connections", {
  method: "POST",
  token: buyer.token,
  body: {
    requestingOrgId: buyer.organization.id,
    targetOrgId: seller.organization.id,
    reason: "Workflow smoke test",
    proposedDealCategory: "Services",
    approxValue: "10000",
    timeline: "30 days",
    requiresNda: true,
  },
});

const acceptedConnection = await request("/connections/" + connection.id + "/respond", {
  method: "POST",
  token: seller.token,
  body: {
    response: "ACCEPTED",
    createWorkspace: true,
  },
});

const workspace = acceptedConnection.workspace;
assert.ok(workspace?.id, "Accepted connection should create a workspace");
assert.equal((workspace.participantOrgIds ?? []).length, 2, "Workspace should include both orgs");

const requirement = await request("/workspaces/" + workspace.id + "/requirements", {
  method: "POST",
  token: buyer.token,
  body: {
    createdByOrgId: buyer.organization.id,
    fields: {
      title: "Smoke delivery scope",
      scope: "One milestone settlement flow",
      deliverables: ["Contract", "Milestone", "Settlement"],
    },
  },
});

const proposal = await request("/workspaces/" + workspace.id + "/proposals", {
  method: "POST",
  token: buyer.token,
  body: {
    proposedByOrgId: buyer.organization.id,
    requirementId: requirement.id,
    terms: {
      title: "Smoke deal terms",
      currency: "USDC",
      value: "1000",
      milestones: [
        { description: "Initial delivery", amount: "1000" },
      ],
    },
  },
});

await request("/workspaces/" + workspace.id + "/proposals/" + proposal.id + "/accept", {
  method: "POST",
  token: seller.token,
});

const termSheet = await request("/workspaces/" + workspace.id + "/term-sheet", {
  token: buyer.token,
});

const approvals = await request("/workspaces/" + workspace.id + "/approvals", {
  token: buyer.token,
});
const buyerApproval = approvals.find((approval) => approval.organizationId === buyer.organization.id);
const sellerApproval = approvals.find((approval) => approval.organizationId === seller.organization.id);
assert.ok(buyerApproval, "Buyer approval should exist");
assert.ok(sellerApproval, "Seller approval should exist");

await request("/workspaces/" + workspace.id + "/approvals/" + buyerApproval.id + "/decide", {
  method: "POST",
  token: buyer.token,
  body: { decision: "APPROVED", notes: "Approved by buyer" },
});
await request("/workspaces/" + workspace.id + "/approvals/" + sellerApproval.id + "/decide", {
  method: "POST",
  token: seller.token,
  body: { decision: "APPROVED", notes: "Approved by seller" },
});

const agreement = await request("/workspaces/" + workspace.id + "/agreement", {
  method: "POST",
  token: buyer.token,
  body: makeFormData(
    { termSheetId: termSheet.id },
    "agreement.txt",
    "Workflow smoke agreement for " + workspace.id,
  ),
});

await request("/workspaces/" + workspace.id + "/agreement/sign", {
  method: "POST",
  token: buyer.token,
});
await request("/workspaces/" + workspace.id + "/agreement/sign", {
  method: "POST",
  token: seller.token,
});

const deployedContract = await request("/workspaces/" + workspace.id + "/contract", {
  method: "POST",
  token: buyer.token,
  body: {
    templateId,
    chain: "MATIC-AMOY",
  },
});

const funding = await request("/workspaces/" + workspace.id + "/fund", {
  method: "POST",
  token: buyer.token,
  body: {
    amount: "1000",
    currency: "USDC",
    idempotencyKey: crypto.randomUUID(),
  },
});

const started = await request("/workspaces/" + workspace.id + "/start", {
  method: "POST",
  token: buyer.token,
});
assert.equal(started.status, "IN_PROGRESS", "Workspace should enter IN_PROGRESS after start");

const milestone = await request("/workspaces/" + workspace.id + "/milestones", {
  method: "POST",
  token: buyer.token,
  body: {
    description: "Smoke milestone",
    amount: "1000",
  },
});

const evidence = await request("/workspaces/" + workspace.id + "/evidence", {
  method: "POST",
  token: buyer.token,
  body: makeFormData(
    {
      evidenceType: "DELIVERABLE",
      submittedByOrgId: buyer.organization.id,
      milestoneId: milestone.id,
    },
    "evidence.txt",
    "Evidence for milestone " + milestone.id,
  ),
});

await request("/workspaces/" + workspace.id + "/milestones/" + milestone.id + "/approve", {
  method: "POST",
  token: seller.token,
  body: {},
});

const settlement = await request("/workspaces/" + workspace.id + "/settle", {
  method: "POST",
  token: buyer.token,
  body: {
    milestoneId: milestone.id,
    settlementStatus: "COMPLETED",
  },
});

const buyerReputation = await request("/workspaces/" + workspace.id + "/reputation", {
  method: "POST",
  token: buyer.token,
  body: {
    organizationId: buyer.organization.id,
    counterpartyOrgId: seller.organization.id,
    roleInDeal: "BUYER",
    dimensions: {
      quality: 5,
      communication: 5,
      timeliness: 5,
    },
  },
});

const sellerReputation = await request("/workspaces/" + workspace.id + "/reputation", {
  method: "POST",
  token: seller.token,
  body: {
    organizationId: seller.organization.id,
    counterpartyOrgId: buyer.organization.id,
    roleInDeal: "SELLER",
    dimensions: {
      quality: 5,
      communication: 5,
      timeliness: 5,
    },
  },
});

const buyerStats = await request("/organizations/" + buyer.organization.id + "/stats", {
  token: buyer.token,
});
const sellerStats = await request("/organizations/" + seller.organization.id + "/stats", {
  token: seller.token,
});

assert.equal(settlement.settlementStatus, "COMPLETED", "Settlement should complete the workspace");
assert.equal(buyerStats.id, buyer.organization.id, "Buyer stats should resolve");
assert.equal(sellerStats.id, seller.organization.id, "Seller stats should resolve");

console.log(JSON.stringify({
  buyer: {
    organizationId: buyer.organization.id,
    verificationStatus: buyer.organization.verificationStatus,
    stats: buyerStats.stats,
    reputationRecordId: buyerReputation.id,
  },
  seller: {
    organizationId: seller.organization.id,
    verificationStatus: seller.organization.verificationStatus,
    stats: sellerStats.stats,
    reputationRecordId: sellerReputation.id,
  },
  workspace: {
    id: workspace.id,
    status: settlement.settlementStatus,
    contractId: deployedContract.id,
    agreementId: agreement.id,
    fundingTransferId: funding.transferId,
    evidenceId: evidence.id,
  },
}, null, 2));
