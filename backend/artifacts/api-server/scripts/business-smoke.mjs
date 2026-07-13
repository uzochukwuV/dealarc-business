import assert from "node:assert/strict";

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000/api").replace(/\/$/, "");
const adminToken = process.env.ADMIN_BEARER_TOKEN;

if (!adminToken) {
  throw new Error("ADMIN_BEARER_TOKEN is required so the smoke test can approve verification cases");
}

async function request(path, options = {}) {
  const method = options.method ?? "GET";
  const token = options.token;
  const body = options.body;

  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(method + " " + path + " failed: " + response.status + " " + JSON.stringify(data));
  }

  return data;
}

async function registerBusiness(index) {
  const email = "smoke-business-" + index + "@example.test";
  const password = "SmokePass-" + index + "-2026";
  const name = "Smoke Business " + index;
  const tokenResponse = await request("/auth/register", {
    method: "POST",
    body: { email, password, name },
  });

  const org = await request("/organizations", {
    method: "POST",
    token: tokenResponse.token,
    body: {
      legalName: "Smoke Holdings " + index,
      tradingName: "Smoke " + index,
      country: "Nigeria",
      industry: "Services",
      regionsServed: ["West Africa"],
      publicProfile: { stage: "smoke-test" },
    },
  });

  const verificationCase = await request("/organizations/" + org.id + "/verification-cases", {
    method: "POST",
    token: tokenResponse.token,
    body: {},
  });

  return { token: tokenResponse.token, org, verificationCase };
}

const businesses = await Promise.all([1, 2, 3, 4].map((index) => registerBusiness(index)));

for (const business of businesses) {
  await request("/admin/verification-cases/" + business.verificationCase.id + "/decide", {
    method: "POST",
    token: adminToken,
    body: { decision: "APPROVED", notes: "Verified by smoke test" },
  });
}

const verifiedOrganizations = await request("/organizations?verifiedOnly=true&limit=20", {
  token: businesses[0].token,
});

assert.ok(Array.isArray(verifiedOrganizations), "Discovery response should be an array");
assert.ok(
  verifiedOrganizations.length >= businesses.length,
  "Expected at least " + businesses.length + " verified businesses, got " + verifiedOrganizations.length,
);

for (const business of businesses) {
  const discovered = verifiedOrganizations.find((org) => org.id === business.org.id);
  assert.ok(discovered, "Organization " + business.org.id + " should appear in discovery");

  const stats = await request("/organizations/" + business.org.id + "/stats", {
    token: business.token,
  });

  assert.equal(stats.id, business.org.id, "Stats endpoint should return the same organization");
  assert.ok(stats.stats, "Stats endpoint should include stats");
  assert.ok(stats.stats.reputation, "Stats endpoint should include reputation data");
}

console.log(JSON.stringify({
  verifiedBusinesses: verifiedOrganizations.slice(0, businesses.length).map((org) => ({
    id: org.id,
    legalName: org.legalName,
    verificationStatus: org.verificationStatus,
  })),
  count: verifiedOrganizations.length,
}, null, 2));
