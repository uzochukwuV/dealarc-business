// Typed shapes mirroring the provided OpenAPI spec's component schemas.
// These are produced by src/backend/*.ts wrapper modules, which translate
// this app's Base44 entities into the spec's field names/casing.

export interface ReputationSummary {
  completedDeals: string;
  disputedDeals: string;
  financedDeals: string;
  totalVolume: string;
  score: string;
}

export interface OrganizationPublicProfile {
  description?: string;
  website?: string;
  productsServices?: string;
  certifications?: string[];
  typicalDealSize?: string;
}

export interface Organization {
  id: string;
  legalName: string;
  tradingName: string | null;
  country: string;
  industry: string;
  regionsServed: string[];
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  publicProfile: OrganizationPublicProfile;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDiscoveryStats {
  identityId: string | null;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
  reputation: ReputationSummary;
}

export interface OrganizationDiscoveryItem extends Organization {
  stats: OrganizationDiscoveryStats;
}

export interface OrganizationUpdate {
  tradingName?: string;
  regionsServed?: string[];
  publicProfile?: OrganizationPublicProfile;
}

// Backend organization_members row (joined with users table).
export interface OrganizationMember {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "FINANCE" | "MEMBER";
  isAuthorizedSigner: boolean;
  joinedAt: string;
  revokedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

// Backend verification_cases row.
export interface VerificationCase {
  id: string;
  organizationId: string;
  status: string;
  submittedAt?: string;
  reviewedAt?: string;
  decision?: string | null;
  reviewerNotes?: string | null;
}

// Backend document_refs row (returned by GET /organizations/:orgId/documents).
export interface OrganizationDocument {
  id: string;
  organizationId: string;
  docType: string;
  ipfsCid: string;
  contentHash: string;
  uploadedBy: string;
  createdAt?: string;
}

export interface Connection {
  id: string;
  requestingOrgId: string;
  targetOrgId: string;
  reason: string | null;
  proposedDealCategory: string | null;
  approxValue: string | null;
  timeline: string | null;
  requiresNda: boolean;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "PROFILE_ONLY" | "MORE_INFO";
  createdAt: string;
  respondedAt: string | null;
  direction?: "SENT" | "RECEIVED";
  counterparty_org_name?: string;
  counterparty_org_industry?: string | null;
  created_date?: string;
  updated_date?: string | null;
}

export interface ConnectionInput {
  requestingOrgId?: string;
  targetOrgId: string;
  reason?: string;
  proposedDealCategory?: string;
  approxValue?: string;
  timeline?: string;
  requiresNda?: boolean;
}

export interface ConnectionRespondInput {
  response: "ACCEPTED" | "DECLINED" | "PROFILE_ONLY" | "MORE_INFO";
  createWorkspace?: boolean;
}

export interface DealWorkspace {
  id: string;
  connectionId: string | null;
  title: string;
  objectiveSummary: string | null;
  status: string;
  participantOrgIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceInput {
  connectionId?: string;
  title: string;
  objectiveSummary?: string;
  counterpartyOrgName?: string;
}

export interface Message {
  id: string;
  workspaceId: string;
  senderUserId: string;
  senderOrgId: string;
  body: string;
  linkedObjectType: string | null;
  linkedObjectId: string | null;
  createdAt: string;
}

export interface MessageInput {
  body: string;
  senderOrgId: string;
}

export interface Requirement {
  id: string;
  workspaceId: string;
  createdByOrgId: string;
  fields: Record<string, any>;
  status: string;
  createdAt: string;
}

export interface RequirementInput {
  createdByOrgId: string;
  fields: Record<string, any>;
}

export interface Proposal {
  id: string;
  workspaceId: string;
  version: number;
  proposedByOrgId: string;
  supersedesProposalId: string | null;
  requirementId: string | null;
  templateId: string | null;
  terms: Record<string, any>;
  status: string;
  createdAt: string;
}

export interface ProposalInput {
  proposedByOrgId: string;
  supersedesProposalId?: string;
  requirementId?: string;
  terms: Record<string, any>;
}

export interface ApprovalRequest {
  id: string;
  workspaceId: string;
  organizationId: string;
  termSheetId: string;
  requiredApprovers: any[];
  policyTier: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  resolvedAt: string | null;
  createdAt: string;
}

export interface ApprovalDecisionInput {
  decision: "APPROVED" | "REJECTED";
  notes?: string;
}

export interface Agreement {
  id: string;
  workspaceId: string;
  termSheetId: string;
  documentRefId: string | null;
  agreementHash: string;
  signatures: any[];
  status: "DRAFTED" | "UNDER_REVIEW" | "LOCKED" | "SIGNED";
  createdAt: string;
}

export interface Milestone {
  id: string;
  dealContractId: string;
  descriptionHash: string | null;
  description: string;
  amount: string;
  dueDate: string | null;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "DISPUTED" | "RELEASED" | "SETTLED";
  // UI-only extensions kept for feature parity (not part of the OpenAPI schema):
  sequence?: number;
  evidence?: any[];
  reviewNote?: string;
}

export interface MilestoneInput {
  description: string;
  descriptionHash?: string;
  amount?: string;
  dueDate?: string;
}

export interface Dispute {
  id: string;
  workspaceId: string;
  dealContractId: string | null;
  openedByOrgId: string;
  reason: string;
  status: "OPEN" | "EVIDENCE_PERIOD" | "UNDER_REVIEW" | "RESOLVED";
  arbitratorId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DisputeInput {
  openedByOrgId: string;
  reason: string;
}

export interface ReputationRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  counterpartyOrgId: string;
  roleInDeal: "BUYER" | "SELLER";
  dimensions: Record<string, any>;
  createdAt: string;
}

export interface ReputationInput {
  organizationId: string;
  counterpartyOrgId: string;
  roleInDeal: "BUYER" | "SELLER";
  dimensions: Record<string, any>;
}
