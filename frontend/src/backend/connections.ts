import { getActiveOrganizationId, getOrganization } from "@/lib/backend-auth";
import type { Connection, ConnectionInput, ConnectionRespondInput } from "./types";

const API_BASE = "/api";

function getStorageToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("sme_access_token");
}

async function request(path, { method = "GET", body } = {}) {
  const headers = new Headers();
  const token = getStorageToken();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
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
    const message = (data && (data.message || data.error || data.detail)) || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function buildOrgLookup(connections: Array<{ requestingOrgId: string; targetOrgId: string }>) {
  const ids = new Set<string>();
  for (const connection of connections) {
    if (connection.requestingOrgId) ids.add(connection.requestingOrgId);
    if (connection.targetOrgId) ids.add(connection.targetOrgId);
  }

  const entries = await Promise.all(
    [...ids].map(async (id) => {
      try {
        return [id, await getOrganization(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function mapConnection(
  connection: any,
  activeOrgId: string | null,
  orgLookup: Record<string, any | null>,
): Connection {
  const sentFromActiveOrg = !!activeOrgId && connection.requestingOrgId === activeOrgId;
  const counterpartyOrgId = sentFromActiveOrg ? connection.targetOrgId : connection.requestingOrgId;
  const counterpartyOrg = orgLookup[counterpartyOrgId] || null;

  return {
    id: connection.id,
    requestingOrgId: connection.requestingOrgId,
    targetOrgId: connection.targetOrgId,
    reason: connection.reason ?? null,
    proposedDealCategory: connection.proposedDealCategory ?? null,
    approxValue: connection.approxValue ?? null,
    timeline: connection.timeline ?? null,
    requiresNda: !!connection.requiresNda,
    status: connection.status,
    createdAt: connection.createdAt ?? connection.created_date ?? new Date().toISOString(),
    respondedAt: connection.respondedAt ?? null,
    direction: sentFromActiveOrg ? "SENT" : "RECEIVED",
    counterparty_org_name: counterpartyOrg?.legalName || counterpartyOrgId,
    counterparty_org_industry: counterpartyOrg?.industry || null,
  };
}

async function enrichConnections(connections: any[]): Promise<Connection[]> {
  const activeOrgId = getActiveOrganizationId();
  const orgLookup = await buildOrgLookup(connections);
  return connections.map((connection) => mapConnection(connection, activeOrgId, orgLookup));
}

export async function listConnections(): Promise<Connection[]> {
  const list = await request("/connections");
  return enrichConnections(list);
}

export async function getConnection(connectionId: string): Promise<Connection> {
  const connection = await request(`/connections/${connectionId}`);
  const [mapped] = await enrichConnections([connection]);
  return mapped;
}

export async function requestConnection(input: ConnectionInput): Promise<Connection> {
  const requestingOrgId = input.requestingOrgId || getActiveOrganizationId();
  if (!requestingOrgId) {
    throw new Error("No active organization is selected");
  }

  const created = await request("/connections", {
    method: "POST",
    body: {
      requestingOrgId,
      targetOrgId: input.targetOrgId,
      reason: input.reason || "",
      proposedDealCategory: input.proposedDealCategory || "",
      approxValue: input.approxValue || "",
      timeline: input.timeline || "",
      requiresNda: !!input.requiresNda,
    },
  });

  return getConnection(created.id);
}

export async function respondToConnection(connectionId: string, input: ConnectionRespondInput): Promise<Connection> {
  await request(`/connections/${connectionId}/respond`, {
    method: "POST",
    body: {
      response: input.response,
      createWorkspace: input.createWorkspace ?? false,
    },
  });
  return getConnection(connectionId);
}
