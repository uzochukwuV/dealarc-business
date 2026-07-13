import { apiRequest } from "@/lib/backend-request.js";
import type { Milestone } from "./types";

function mapMilestone(row: any): Milestone & Record<string, any> {
  return {
    id: row.id,
    dealContractId: row.dealContractId || row.workspaceId || "",
    descriptionHash: row.descriptionHash ?? null,
    description: row.description || row.name || "",
    amount: row.amount || "",
    dueDate: row.dueDate ?? null,
    status: row.status,
    sequence: row.sequence,
    evidence: row.evidence || [],
    reviewNote: row.reviewNote ?? row.review_note ?? null,
    submitted_at: row.submittedAt || row.submitted_at || null,
    reviewed_at: row.reviewedAt || row.reviewed_at || null,
  };
}

export async function listMilestones(workspaceId: string): Promise<Milestone[]> {
  const list = await apiRequest(`/workspaces/${workspaceId}/milestones`);
  return list.map(mapMilestone);
}

export async function createMilestone(
  workspaceId: string,
  input: { description: string; descriptionHash?: string; amount?: string; dueDate?: string },
): Promise<Milestone> {
  const created = await apiRequest(`/workspaces/${workspaceId}/milestones`, {
    method: "POST",
    body: input,
  });
  return mapMilestone(created) as Milestone;
}

export async function submitMilestoneEvidence(
  workspaceId: string,
  milestoneId: string,
  file: File,
  submittedByOrgId: string,
  evidenceType = "DELIVERABLE",
): Promise<any> {
  const form = new FormData();
  form.append("file", file);
  form.append("evidenceType", evidenceType);
  form.append("submittedByOrgId", submittedByOrgId);
  form.append("milestoneId", milestoneId);
  return apiRequest(`/workspaces/${workspaceId}/evidence`, {
    method: "POST",
    body: form,
  });
}

export async function approveMilestone(
  workspaceId: string,
  milestoneId: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
): Promise<Milestone> {
  const updated = await apiRequest(`/workspaces/${workspaceId}/milestones/${milestoneId}/approve`, {
    method: "POST",
    body: { decision, note },
  });
  return mapMilestone(updated) as Milestone;
}
