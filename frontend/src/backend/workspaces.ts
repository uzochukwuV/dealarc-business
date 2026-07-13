import { apiRequest } from "@/lib/backend-request.js";

async function orgLabel(orgId) {
  try {
    const org = await apiRequest(`/organizations/${orgId}`);
    return org.tradingName || org.legalName || orgId;
  } catch {
    return orgId;
  }
}

export async function listWorkspaces() {
  return apiRequest("/workspaces");
}

export async function getWorkspace(workspaceId) {
  return apiRequest(`/workspaces/${workspaceId}`);
}

export async function createWorkspace(input) {
  return apiRequest("/workspaces", {
    method: "POST",
    body: {
      connectionId: input.connectionId ?? undefined,
      title: input.title,
      objectiveSummary: input.objectiveSummary ?? undefined,
    },
  });
}

export async function finalizeTermSheet(workspaceId, acceptedProposalId = null, terms = null) {
  return apiRequest(`/workspaces/${workspaceId}/term-sheet`, {
    method: "POST",
    body: {
      acceptedProposalId: acceptedProposalId ?? undefined,
      terms: terms ?? undefined,
    },
  });
}

export async function listMessages(workspaceId) {
  const rows = await apiRequest(`/workspaces/${workspaceId}/messages`);
  const orgNames = new Map();
  await Promise.all(
    [...new Set(rows.map((row) => row.senderOrgId).filter(Boolean))].map(async (orgId) => {
      orgNames.set(orgId, await orgLabel(orgId));
    }),
  );
  return rows.map((row) => ({
    id: row.id,
    workspace_id: row.workspaceId,
    sender_user_id: row.senderUserId,
    sender_org_id: row.senderOrgId,
    sender_name: orgNames.get(row.senderOrgId) || row.senderOrgId,
    sender_org: orgNames.get(row.senderOrgId) || row.senderOrgId,
    sender_role: "Member",
    text: row.body,
    converted_to: row.linkedObjectType || "none",
    linked_object_id: row.linkedObjectId ?? null,
    created_date: row.createdAt,
  }));
}

export async function sendMessage(workspaceId, input) {
  return apiRequest(`/workspaces/${workspaceId}/messages`, {
    method: "POST",
    body: {
      body: input.body,
      senderOrgId: input.senderOrgId,
    },
  });
}

export async function convertMessage(workspaceId, messageId, input) {
  return apiRequest(`/workspaces/${workspaceId}/messages/${messageId}/convert`, {
    method: "POST",
    body: {
      targetType: input.targetType,
      senderOrgId: input.senderOrgId,
      fields: input.fields ?? {},
    },
  });
}
