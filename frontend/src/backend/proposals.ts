import { apiRequest } from "@/lib/backend-request.js";
import type { Proposal } from "./types";

function mapProposal(row: any): Proposal & Record<string, any> {
  const terms = row.terms || {};
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    proposedByOrgId: row.proposedByOrgId || "",
    supersedesProposalId: row.supersedesProposalId ?? null,
    requirementId: row.requirementId ?? null,
    templateId: row.templateId ?? null,
    terms,
    status: row.status,
    createdAt: row.createdAt,
    price: terms.price,
    quantity: terms.quantity,
    delivery_terms: terms.deliveryTerms,
    payment_structure: terms.paymentStructure,
    warranty: terms.warranty,
    validity: terms.validity,
    change_summary: terms.changeSummary,
    created_by_name: terms.createdByName || row.proposedByOrgId || "",
    created_date: row.createdAt,
    accepted_by_org_ids: row.acceptedByOrgIds || [],
  };
}

export async function listProposals(workspaceId: string): Promise<Proposal[]> {
  const list = await apiRequest(`/workspaces/${workspaceId}/proposals`);
  return list.map(mapProposal);
}

export async function createProposal(
  workspaceId: string,
  terms: Record<string, any>,
  _version: number,
  proposedByOrgId: string,
  createdByName: string,
): Promise<Proposal> {
  const created = await apiRequest(`/workspaces/${workspaceId}/proposals`, {
    method: "POST",
    body: {
      proposedByOrgId,
      terms: {
        price: terms.price,
        quantity: terms.quantity,
        deliveryTerms: terms.deliveryTerms,
        paymentStructure: terms.paymentStructure,
        warranty: terms.warranty,
        validity: terms.validity,
        changeSummary: terms.changeSummary || `Version ${_version}`,
        createdByName,
      },
    },
  });
  return mapProposal(created) as Proposal;
}

export async function acceptProposal(workspaceId: string, proposalId: string): Promise<Proposal> {
  const updated = await apiRequest(`/workspaces/${workspaceId}/proposals/${proposalId}/accept`, {
    method: "POST",
    body: {},
  });
  return mapProposal(updated) as Proposal;
}

export async function rejectProposal(workspaceId: string, proposalId: string): Promise<Proposal> {
  const updated = await apiRequest(`/workspaces/${workspaceId}/proposals/${proposalId}/reject`, {
    method: "POST",
    body: {},
  });
  return mapProposal(updated) as Proposal;
}
