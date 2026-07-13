import { getStoredToken } from "@/lib/backend-auth.js";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function normalizeError(data, status) {
  if (!data) return `HTTP ${status}`;
  if (typeof data === "string") return data;
  return data.message || data.error || data.detail || `HTTP ${status}`;
}

export async function apiRequest(path, { method = "GET", body, headers } = {}) {
  const finalHeaders = new Headers(headers || {});
  const token = getStoredToken();
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
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(normalizeError(data, response.status));
  }

  return data;
}
