// Real backend client shim that replaces the Base44 SDK.
//
// The frontend was scaffolded against Base44's `base44.entities.<X>.{list,get,create,update,filter,delete}`
// and `base44.auth.me()` API. This module provides the same surface backed by the actual
// Express API server (see backend/artifacts/api-server/src/routes/*). Endpoints that have no
// corresponding backend route are implemented as explicit, fail-loud operations so the gap is
// visible rather than silently returning fake data.

import { getStoredToken } from "@/lib/backend-auth";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function token() {
  return getStoredToken();
}

async function request(path, { method = "GET", body } = {}) {
  const finalHeaders = new Headers();
  const t = token();
  if (t) finalHeaders.set("authorization", `Bearer ${t}`);
  if (body && !(body instanceof FormData)) {
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
  return data;
}

// Endpoint map for each entity used across the frontend.
const ENTITY_ROUTES = {
  Organization: {
    list: "/organizations",
    get: (id) => `/organizations/${id}`,
    update: (id) => `/organizations/${id}`,
  },
  Connection: {
    list: "/connections",
    get: (id) => `/connections/${id}`,
    create: "/connections",
    update: (id) => `/connections/${id}`,
    extra: {
      respond: (id, body) => ({ method: "POST", path: `/connections/${id}/respond`, body }),
    },
  },
  Workspace: {
    list: "/workspaces",
    get: (id) => `/workspaces/${id}`,
    create: "/workspaces",
    update: (id) => `/workspaces/${id}`,
    extra: {
      addMember: (id, body) => ({ method: "POST", path: `/workspaces/${id}/members`, body }),
      messages: (id) => ({ method: "GET", path: `/workspaces/${id}/messages` }),
      addMessage: (id, body) => ({ method: "POST", path: `/workspaces/${id}/messages`, body }),
    },
  },
  // Entities below have no dedicated 1:1 endpoint wired yet; operations throw clear errors.
  Requirement: {},
  Proposal: {},
  Milestone: {},
  Approval: {},
  Review: {},
  Transaction: {},
  Opportunity: {},
  WorkspaceDocument: {},
  Message: {},
};

function makeEntity(name) {
  const route = ENTITY_ROUTES[name] || {};
  const entity = {
    async list(sort, limit) {
      if (!route.list) throw new Error(`Entity ${name}.list is not backed by an endpoint yet`);
      const qs = new URLSearchParams();
      if (limit != null) qs.set("limit", String(limit));
      const q = qs.toString();
      return request(`${route.list}${q ? `?${q}` : ""}`);
    },
    async get(id) {
      if (!route.get) throw new Error(`Entity ${name}.get is not backed by an endpoint yet`);
      return request(route.get(id));
    },
    async create(body) {
      if (!route.create) throw new Error(`Entity ${name}.create is not backed by an endpoint yet`);
      return request(route.create, { method: "POST", body });
    },
    async update(id, body) {
      if (!route.update) throw new Error(`Entity ${name}.update is not backed by an endpoint yet`);
      return request(route.update(id), { method: "PATCH", body });
    },
    async filter(where = {}, sort, limit) {
      const all = await entity.list(sort, limit);
      if (!where || Object.keys(where).length === 0) return all;
      return all.filter((row) =>
        Object.entries(where).every(([k, v]) => row[k] === v),
      );
    },
    async delete(id) {
      if (!route.remove) throw new Error(`Entity ${name}.delete is not backed by an endpoint yet`);
      return request(route.remove(id), { method: "DELETE" });
    },
  };

  if (route.extra) {
    for (const [fnName, build] of Object.entries(route.extra)) {
      entity[fnName] = async (...args) => {
        const { method, path, body } = build(...args);
        return request(path, { method, body });
      };
    }
  }
  return entity;
}

const entityCache = {};
function entities(name) {
  if (!entityCache[name]) entityCache[name] = makeEntity(name);
  return entityCache[name];
}

export const base44 = {
  entities: new Proxy(
    {},
    {
      get: (_t, name) => entities(name),
    },
  ),
  auth: {
    async me() {
      return request("/auth/me");
    },
    async updateMe(body) {
      return request("/auth/me", { method: "PATCH", body });
    },
  },
  integrations: {
    Core: {
      async InvokeLLM() {
        throw new Error("integrations.Core.InvokeLLM is not backed by the real backend");
      },
      async UploadFile() {
        throw new Error("integrations.Core.UploadFile is not backed by the real backend");
      },
    },
  },
};

export default base44;
