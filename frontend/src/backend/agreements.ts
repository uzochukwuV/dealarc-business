import { apiRequest } from "@/lib/backend-request.js";
import type { Agreement } from "./types";

function mapAgreement(row: any): Agreement {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    termSheetId: row.termSheetId || "",
    documentRefId: row.documentRefId ?? null,
    agreementHash: row.agreementHash || "",
    signatures: row.signatures || [],
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function getAgreement(workspaceId: string): Promise<Agreement> {
  const row = await apiRequest(`/workspaces/${workspaceId}/agreement`);
  return mapAgreement(row);
}

export async function uploadAgreement(workspaceId: string, file: File, termSheetId: string): Promise<Agreement> {
  const form = new FormData();
  form.append("file", file);
  form.append("termSheetId", termSheetId);
  const row = await apiRequest(`/workspaces/${workspaceId}/agreement`, {
    method: "POST",
    body: form,
  });
  return mapAgreement(row);
}

export async function signAgreement(workspaceId: string): Promise<Agreement> {
  const row = await apiRequest(`/workspaces/${workspaceId}/agreement/sign`, {
    method: "POST",
    body: {},
  });
  return mapAgreement(row);
}
