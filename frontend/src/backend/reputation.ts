import { apiRequest } from "@/lib/backend-request.js";
import type { ReputationRecord, ReputationInput } from "./types";

function mapRecord(row: any): ReputationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId || "",
    workspaceId: row.workspaceId,
    counterpartyOrgId: row.counterpartyOrgId || "",
    roleInDeal: row.roleInDeal || "BUYER",
    dimensions: row.dimensions || {},
    createdAt: row.createdAt,
  };
}

export async function listReputation(workspaceId: string): Promise<ReputationRecord[]> {
  const list = await apiRequest(`/workspaces/${workspaceId}/reputation`);
  return (list || []).map(mapRecord);
}

// workspaceTitle is accepted for call-site convenience but the backend derives
// the workspace from the path id; it is intentionally not sent in the body.
export async function submitReputation(
  workspaceId: string,
  _workspaceTitle: string,
  input: ReputationInput,
): Promise<ReputationRecord> {
  const row = await apiRequest(`/workspaces/${workspaceId}/reputation`, {
    method: "POST",
    body: {
      organizationId: input.organizationId,
      counterpartyOrgId: input.counterpartyOrgId,
      roleInDeal: input.roleInDeal,
      dimensions: input.dimensions,
    },
  });
  return mapRecord(row);
}
