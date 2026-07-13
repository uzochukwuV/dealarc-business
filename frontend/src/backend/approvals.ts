import { apiRequest } from "@/lib/backend-request.js";
import type { ApprovalRequest } from "./types";

function mapApproval(row: any): ApprovalRequest & Record<string, any> {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId || "",
    termSheetId: row.termSheetId || "",
    requiredApprovers: row.requiredApprovers || [],
    policyTier: row.policyTier || "",
    status: row.status,
    resolvedAt: row.resolvedAt || null,
    createdAt: row.createdAt,
  };
}

export async function listApprovals(workspaceId: string): Promise<ApprovalRequest[]> {
  const list = await apiRequest(`/workspaces/${workspaceId}/approvals`);
  return list.map(mapApproval);
}

export async function addApprover(
  workspaceId: string,
  name: string,
  role: string,
  org: string,
  _sequence: number,
): Promise<ApprovalRequest> {
  const created = await apiRequest(`/workspaces/${workspaceId}/approvals`, {
    method: "POST",
    body: {
      organizationId: org,
      requiredApprovers: [{ name, role: role || "Reviewer" }],
      policyTier: "STANDARD",
    },
  });
  return mapApproval(created) as ApprovalRequest;
}

export async function decideApproval(
  workspaceId: string,
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  notes: string,
): Promise<ApprovalRequest> {
  const updated = await apiRequest(`/workspaces/${workspaceId}/approvals/${approvalId}/decide`, {
    method: "POST",
    body: { decision, notes },
  });
  return mapApproval(updated) as ApprovalRequest;
}
