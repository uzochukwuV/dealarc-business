import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const docTypeEnum = [
  "REGISTRATION_CERT",
  "ID",
  "PROOF_OF_ADDRESS",
  "AGREEMENT",
  "INVOICE",
  "EVIDENCE",
  "OTHER",
] as const;

export const documentRefsTable = pgTable("document_refs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  ipfsCid: text("ipfs_cid").notNull(),
  contentHash: text("content_hash").notNull(),
  // Encrypted DEK (AES key wrapped — stored as hex). In production this
  // would point to a KMS key ref. For MVP we store the DEK encrypted
  // with the server's master key (SESSION_SECRET derived).
  encryptionKeyRef: text("encryption_key_ref").notNull(),
  // IV used for the file encryption, stored alongside the ciphertext ref
  encryptionIv: text("encryption_iv").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminDocumentAccessLogsTable = pgTable("admin_document_access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => usersTable.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documentRefsTable.id),
  reason: text("reason").notNull().default("verification_review"),
  context: text("context"),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Scoped, time-boxed document access grants for dispute arbitrators.
// granteeId = arbitrator user; workspaceId scopes which docs are accessible.
export const disputeDocGrantsTable = pgTable("dispute_doc_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  disputeId: uuid("dispute_id").notNull(), // no FK — disputes live in deals schema
  workspaceId: uuid("workspace_id").notNull(),
  granteeId: uuid("grantee_id").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentRefSchema = createInsertSchema(documentRefsTable).omit({
  id: true,
  uploadedAt: true,
});

export type DocumentRef = typeof documentRefsTable.$inferSelect;
export type AdminDocumentAccessLog = typeof adminDocumentAccessLogsTable.$inferSelect;
export type DisputeDocGrant = typeof disputeDocGrantsTable.$inferSelect;
export type InsertDocumentRef = z.infer<typeof insertDocumentRefSchema>;
