import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealWorkspacesTable } from "./workspaces";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { documentRefsTable } from "./documents";

export const requirementsTable = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  createdByOrgId: uuid("created_by_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  fields: jsonb("fields").notNull().default({}),
  status: text("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const proposalsTable = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  proposedByOrgId: uuid("proposed_by_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  supersedesProposalId: uuid("supersedes_proposal_id"),
  requirementId: uuid("requirement_id").references(() => requirementsTable.id),
  templateId: text("template_id"),
  terms: jsonb("terms").notNull().default({}),
  status: text("status").notNull().default("DRAFT"),
  acceptedByOrgIds: uuid("accepted_by_org_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const termSheetsTable = pgTable("term_sheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  acceptedProposalId: uuid("accepted_proposal_id")
    .notNull()
    .references(() => proposalsTable.id),
  // Immutable snapshot of accepted proposal terms
  terms: jsonb("terms").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalRequestsTable = pgTable("approval_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  termSheetId: uuid("term_sheet_id")
    .notNull()
    .references(() => termSheetsTable.id),
  requiredApprovers: jsonb("required_approvers").notNull().default([]),
  policyTier: text("policy_tier").notNull().default("STANDARD"),
  status: text("status").notNull().default("PENDING"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agreementsTable = pgTable("agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  termSheetId: uuid("term_sheet_id")
    .notNull()
    .references(() => termSheetsTable.id),
  documentRefId: uuid("document_ref_id").references(() => documentRefsTable.id),
  agreementHash: text("agreement_hash").notNull(),
  signatures: jsonb("signatures").notNull().default([]),
  status: text("status").notNull().default("DRAFTED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dealContractsTable = pgTable("deal_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  agreementId: uuid("agreement_id")
    .notNull()
    .references(() => agreementsTable.id),
  templateId: text("template_id"),
  onchainDealId: text("onchain_deal_id"),
  chain: text("chain"),
  contractAddress: text("contract_address"),
  settlementStatus: text("settlement_status").notNull().default("PENDING_DEPLOYMENT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const milestonesTable = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealContractId: uuid("deal_contract_id")
    .notNull()
    .references(() => dealContractsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  descriptionHash: text("description_hash"),
  onchainMilestoneIndex: integer("onchain_milestone_index"),
  amount: text("amount").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  status: text("status").notNull().default("PENDING"),
});

export const evidenceTable = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  milestoneId: uuid("milestone_id").references(() => milestonesTable.id),
  submittedByOrgId: uuid("submitted_by_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  evidenceType: text("evidence_type").notNull(),
  documentRefId: uuid("document_ref_id").references(() => documentRefsTable.id),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputesTable = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  dealContractId: uuid("deal_contract_id").references(() => dealContractsTable.id),
  openedByOrgId: uuid("opened_by_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("OPEN"),
  arbitratorId: uuid("arbitrator_id").references(() => usersTable.id),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reputationRecordsTable = pgTable("reputation_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id),
  counterpartyOrgId: uuid("counterparty_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  roleInDeal: text("role_in_deal").notNull(),
  dimensions: jsonb("dimensions").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRequirementSchema = createInsertSchema(requirementsTable).omit({ id: true, createdAt: true });
export const insertProposalSchema = createInsertSchema(proposalsTable).omit({ id: true, createdAt: true });
export const insertTermSheetSchema = createInsertSchema(termSheetsTable).omit({ id: true, createdAt: true });
export const insertApprovalRequestSchema = createInsertSchema(approvalRequestsTable).omit({ id: true, createdAt: true });
export const insertAgreementSchema = createInsertSchema(agreementsTable).omit({ id: true, createdAt: true });
export const insertDealContractSchema = createInsertSchema(dealContractsTable).omit({ id: true, createdAt: true });
export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({ id: true });
export const insertEvidenceSchema = createInsertSchema(evidenceTable).omit({ id: true, createdAt: true });
export const insertDisputeSchema = createInsertSchema(disputesTable).omit({ id: true, createdAt: true });
export const insertReputationSchema = createInsertSchema(reputationRecordsTable).omit({ id: true, createdAt: true });

export type Requirement = typeof requirementsTable.$inferSelect;
export type Proposal = typeof proposalsTable.$inferSelect;
export type TermSheet = typeof termSheetsTable.$inferSelect;
export type ApprovalRequest = typeof approvalRequestsTable.$inferSelect;
export type Agreement = typeof agreementsTable.$inferSelect;
export type DealContract = typeof dealContractsTable.$inferSelect;
export type Milestone = typeof milestonesTable.$inferSelect;
export type Evidence = typeof evidenceTable.$inferSelect;
export type Dispute = typeof disputesTable.$inferSelect;
export type ReputationRecord = typeof reputationRecordsTable.$inferSelect;
