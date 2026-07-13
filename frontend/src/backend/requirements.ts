import { apiRequest } from "@/lib/backend-request.js";
import type { Requirement } from "./types";

function mapRequirement(row: any): Requirement & Record<string, any> {
  const fields = row.fields || {};
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdByOrgId: row.createdByOrgId || "",
    fields,
    item: fields.item,
    quantity: fields.quantity,
    specs: fields.specs,
    delivery: fields.delivery,
    deadline: fields.deadline,
    budget_range: fields.budgetRange,
    certifications: fields.certifications,
    locked: row.status === "SUPERSEDED",
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function listRequirements(workspaceId: string): Promise<Requirement[]> {
  const list = await apiRequest(`/workspaces/${workspaceId}/requirements`);
  return list.map(mapRequirement);
}

export async function createRequirement(
  workspaceId: string,
  input: { createdByOrgId: string; fields: Record<string, any> },
): Promise<Requirement> {
  const created = await apiRequest(`/workspaces/${workspaceId}/requirements`, {
    method: "POST",
    body: input,
  });
  return mapRequirement(created) as Requirement;
}

export async function saveRequirement(
  workspaceId: string,
  requirementId: string | null,
  input: { createdByOrgId: string; fields: Record<string, any> },
): Promise<Requirement> {
  if (requirementId) {
    const updated = await apiRequest(`/workspaces/${workspaceId}/requirements/${requirementId}`, {
      method: "PATCH",
      body: input,
    });
    return mapRequirement(updated) as Requirement;
  }
  return createRequirement(workspaceId, input);
}

export async function lockLatestRequirement(workspaceId: string): Promise<void> {
  const list = await listRequirements(workspaceId);
  const latest = list[0] as any;
  if (!latest?.id) return;
  await apiRequest(`/workspaces/${workspaceId}/requirements/${latest.id}/lock`, {
    method: "POST",
    body: {},
  });
}
