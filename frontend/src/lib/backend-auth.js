const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "sme_access_token";
const USER_KEY = "sme_auth_user_id";
const ORG_KEY_PREFIX = "sme_active_org_id:";
const PROVISIONING_KEY_PREFIX = "sme_active_org_provisioning:";

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
}

export class BackendApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.data = data;
  }
}

export function getStoredToken() {
  const storage = getStorage();
  return storage?.getItem(TOKEN_KEY) ?? null;
}

export function getStoredUserId() {
  const storage = getStorage();
  return storage?.getItem(USER_KEY) ?? null;
}

export function getActiveOrganizationId(userId = getStoredUserId()) {
  const storage = getStorage();
  if (!storage || !userId) return null;
  return storage.getItem(`${ORG_KEY_PREFIX}${userId}`);
}

export function getActiveOrganizationProvisioning(userId = getStoredUserId()) {
  const storage = getStorage();
  if (!storage || !userId) return null;
  return readJson(storage.getItem(`${PROVISIONING_KEY_PREFIX}${userId}`));
}

export function storeAuthSession({ token, userId }) {
  const storage = getStorage();
  if (!storage) return;
  if (token) storage.setItem(TOKEN_KEY, token);
  if (userId) storage.setItem(USER_KEY, userId);
}

export function storeActiveOrganization(orgId, provisioning = null, userId = getStoredUserId()) {
  const storage = getStorage();
  if (!storage || !userId || !orgId) return;
  storage.setItem(`${ORG_KEY_PREFIX}${userId}`, orgId);
  if (provisioning) {
    writeJson(`${PROVISIONING_KEY_PREFIX}${userId}`, provisioning);
  }
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) return;
  const userId = storage.getItem(USER_KEY);
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
  if (userId) {
    storage.removeItem(`${ORG_KEY_PREFIX}${userId}`);
    storage.removeItem(`${PROVISIONING_KEY_PREFIX}${userId}`);
  }
}

function normalizeResponseData(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  return data.message || data.error || data.detail || fallback;
}

async function request(path, { method = "GET", token, body, headers } = {}) {
  const finalHeaders = new Headers(headers || {});
  if (token && !finalHeaders.has("authorization")) {
    finalHeaders.set("authorization", `Bearer ${token}`);
  }
  if (body && !(body instanceof FormData) && typeof body !== "string" && !finalHeaders.has("content-type")) {
    finalHeaders.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body:
      body == null
        ? undefined
        : body instanceof FormData || typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

  const text = await response.text();
  const data = normalizeResponseData(text);

  if (!response.ok) {
    throw new BackendApiError(
      response.status,
      getErrorMessage(data, `HTTP ${response.status}`),
      data,
    );
  }

  return data;
}

export async function registerAccount(input) {
  const data = await request("/auth/register", {
    method: "POST",
    body: input,
  });
  storeAuthSession({ token: data.token, userId: data.user.id });
  return data;
}

export async function loginAccount(input) {
  const data = await request("/auth/login", {
    method: "POST",
    body: input,
  });
  storeAuthSession({ token: data.token, userId: data.user.id });
  return data;
}

export async function getCurrentUser(token = getStoredToken()) {
  return request("/auth/me", { token });
}

export async function createOrganization(input, token = getStoredToken()) {
  const data = await request("/organizations", {
    method: "POST",
    token,
    body: input,
  });
  storeActiveOrganization(data.id, data.provisioning);
  return data;
}

export async function getOrganization(orgId, token = getStoredToken()) {
  return request(`/organizations/${orgId}`, { token });
}

export async function getOrganizationStats(orgId, token = getStoredToken()) {
  return request(`/organizations/${orgId}/stats`, { token });
}

export async function uploadOrganizationDocument(orgId, file, docType, token = getStoredToken()) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", docType);

  return request(`/organizations/${orgId}/documents`, {
    method: "POST",
    token,
    body: formData,
  });
}

export async function submitVerificationCase(orgId, token = getStoredToken()) {
  return request(`/organizations/${orgId}/verification-cases`, {
    method: "POST",
    token,
    body: {},
  });
}

export async function listOrganizations(filters = {}, token = getStoredToken()) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.country) query.set("country", filters.country);
  if (filters.industry) query.set("industry", filters.industry);
  if (filters.verificationStatus) query.set("verificationStatus", filters.verificationStatus);
  if (filters.verifiedOnly) query.set("verifiedOnly", "true");
  if (filters.limit != null) query.set("limit", String(filters.limit));
  if (filters.offset != null) query.set("offset", String(filters.offset));

  const suffix = query.toString();
  return request(`/organizations${suffix ? `?${suffix}` : ""}`, { token });
}

export async function getOrganizationWallet(orgId, token = getStoredToken()) {
  return request(`/organizations/${orgId}/wallet`, { token });
}

export async function logout(redirectTo = "/login") {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}
