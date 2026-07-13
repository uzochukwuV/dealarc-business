import { apiRequest } from "@/lib/backend-request.js";
import type { Dispute } from "./types";

function mapDispute(row: any): Dispute {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    dealContractId: row.dealContractId ?? null,
    openedByOrgId: row.openedByOrgId || "",
    reason: row.reason || "",
    status: row.status,
    arbitratorId: row.arbitratorId ?? null,
    resolution: row.resolution ?? null,
    resolvedAt: row.resolvedAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function getDispute(workspaceId: string): Promise<Dispute> {
  const row = await apiRequest(`/workspaces/${workspaceId}/dispute`);
  return mapDispute(row);
}

export async function openDispute(workspaceId: string, openedByOrgId: string, reason: string): Promise<Dispute> {
  const row = await apiRequest(`/workspaces/${workspaceId}/dispute`, {
    method: "POST",
    body: { openedByOrgId, reason },
  });
  return mapDispute(row);
}

export async function submitDisputeEvidence(workspaceId: string, evidence: any[]): Promise<void> {
  await apiRequest(`/workspaces/${workspaceId}/dispute`, {
    method: "PATCH",
    body: { evidence },
  });
}

export async function resolveDispute(workspaceId: string, resolution: string): Promise<Dispute> {
  const row = await apiRequest(`/workspaces/${workspaceId}/dispute/resolve`, {
    method: "POST",
    body: { resolution },
  });
  return mapDispute(row);
}
