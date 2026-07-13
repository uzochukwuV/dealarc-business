import { getStoredToken } from "@/lib/backend-auth";
import type {
  Organization,
  OrganizationDiscoveryItem,
  OrganizationUpdate,
  OrganizationMember,
  VerificationCase,
  OrganizationDocument,
} from "./types";

const API_BASE = "/api";

function getToken(): string | null {
  return getStoredToken();
}

type TokenArg = string | null | undefined;

async function request<T = any>(
  path: string,
  { method = "GET", token, body, headers }: {
    method?: string;
    token?: TokenArg;
    body?: any;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const finalHeaders = new Headers(headers || {});
  const authToken = token === undefined ? getToken() : token;
  if (authToken && !finalHeaders.has("authorization")) {
    finalHeaders.set("authorization", `Bearer ${authToken}`);
  }
  if (body && !(body instanceof FormData) && !finalHeaders.has("content-type")) {
    finalHeaders.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body:
      body == null
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.detail)) || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

// ── Backend field mapping ──────────────────────────────────────────────────────
// The real API (Drizzle/Postgres) returns camelCase snake_case-less fields:
//   id, legalName, tradingName, country, industry, regionsServed,
//   registrationNumber, taxId, verificationStatus, publicProfile,
//   createdAt, updatedAt, wallets?
// Base44-derived frontend shapes (Organization / OrganizationDiscoveryItem) expect
// a slightly different shape, so we normalize here.

function toOrganization(o: any): Organization {
  const pp = o.publicProfile || {};
  return {
    id: o.id,
    legalName: o.legalName ?? "",
    tradingName: o.tradingName ?? null,
    country: o.country ?? "",
    industry: o.industry ?? "",
    regionsServed: o.regionsServed ?? [],
    verificationStatus: (o.verificationStatus ?? "UNVERIFIED") as Organization["verificationStatus"],
    publicProfile: {
      description: pp.description ?? "",
      website: pp.website ?? "",
      productsServices: pp.productsServices ?? "",
      certifications: pp.certifications ?? [],
      typicalDealSize: pp.typicalDealSize ?? "",
    },
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function toDiscoveryItem(o: any): OrganizationDiscoveryItem {
  const stats = o.stats ?? {};
  return {
    ...toOrganization(o),
    stats: {
      identityId: stats.identityId ?? null,
      verifiedAt: stats.verifiedAt ?? null,
      verificationExpiresAt: stats.verificationExpiresAt ?? null,
      reputation: stats.reputation ?? {
        completedDeals: "0",
        disputedDeals: "0",
        financedDeals: "0",
        totalVolume: "0",
        score: "0",
      },
    },
  };
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export async function listOrganizations(params: {
  q?: string;
  country?: string;
  industry?: string;
  verificationStatus?: string;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<OrganizationDiscoveryItem[]> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.country) query.set("country", params.country);
  if (params.industry) query.set("industry", params.industry);
  if (params.verificationStatus) query.set("verificationStatus", params.verificationStatus);
  if (params.verifiedOnly) query.set("verifiedOnly", "true");
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const orgs = await request<any[]>(`/organizations${qs ? `?${qs}` : ""}`);
  return orgs.map(toDiscoveryItem);
}

export async function getOrganization(orgId: string): Promise<Organization> {
  const o = await request<any>(`/organizations/${orgId}`);
  return toOrganization(o);
}

export async function getOrganizationStats(orgId: string): Promise<OrganizationDiscoveryItem> {
  const o = await request<any>(`/organizations/${orgId}/stats`);
  return toDiscoveryItem(o);
}

export async function updateOrganization(
  orgId: string,
  data: OrganizationUpdate,
): Promise<Organization> {
  // Backend PATCH only accepts tradingName, regionsServed, publicProfile.
  const patch: Record<string, any> = {};
  if (data.tradingName !== undefined) patch.tradingName = data.tradingName;
  if (data.regionsServed !== undefined) patch.regionsServed = data.regionsServed;
  if (data.publicProfile !== undefined) patch.publicProfile = data.publicProfile;
  const updated = await request<any>(`/organizations/${orgId}`, {
    method: "PATCH",
    body: patch,
  });
  return toOrganization(updated);
}

// ── Members ─────────────────────────────────────────────────────────────────────

export async function listOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  return request<OrganizationMember[]>(`/organizations/${orgId}/members`);
}

export async function addOrganizationMember(
  orgId: string,
  input: { userId: string; role?: string; isAuthorizedSigner?: boolean },
): Promise<OrganizationMember> {
  return request<OrganizationMember>(`/organizations/${orgId}/members`, {
    method: "POST",
    body: input,
  });
}

export async function updateOrganizationMember(
  orgId: string,
  memberId: string,
  input: { role?: string; isAuthorizedSigner?: boolean },
): Promise<OrganizationMember> {
  return request<OrganizationMember>(`/organizations/${orgId}/members/${memberId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function removeOrganizationMember(
  orgId: string,
  memberId: string,
): Promise<void> {
  await request(`/organizations/${orgId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// ── Verification ────────────────────────────────────────────────────────────────

export async function listVerificationCases(orgId: string): Promise<VerificationCase[]> {
  return request<VerificationCase[]>(`/organizations/${orgId}/verification-cases`);
}

export async function submitVerificationCase(orgId: string): Promise<VerificationCase> {
  return request<VerificationCase>(`/organizations/${orgId}/verification-cases`, {
    method: "POST",
    body: {},
  });
}

// ── Documents ───────────────────────────────────────────────────────────────────

export async function listOrganizationDocuments(orgId: string): Promise<OrganizationDocument[]> {
  return request<OrganizationDocument[]>(`/organizations/${orgId}/documents`);
}

export async function uploadOrganizationDocument(
  orgId: string,
  file: File,
  docType: string,
): Promise<OrganizationDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", docType);
  return request<OrganizationDocument>(`/organizations/${orgId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export function organizationDocumentDownloadUrl(orgId: string, docId: string): string {
  return `${API_BASE}/documents/${docId}/download`;
}
