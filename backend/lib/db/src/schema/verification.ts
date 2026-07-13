import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const verificationCasesTable = pgTable("verification_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("SUBMITTED"),
  reviewerAdminId: uuid("reviewer_admin_id").references(() => usersTable.id),
  decisionNotes: text("decision_notes"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationAttestationsTable = pgTable("verification_attestations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  claim: text("claim").notNull().default("KYB_VERIFIED"),
  issuer: text("issuer").notNull().default("platform-admin"),
  reviewerId: uuid("reviewer_id").references(() => usersTable.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked: boolean("revoked").notNull().default(false),
});

// Time-boxed review session — grants an admin decrypt access to a case's documents.
// Created by POST /admin/verification-cases/:caseId/open-session; expires after 2 h.
export const adminReviewSessionsTable = pgTable("admin_review_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => usersTable.id),
  caseId: uuid("case_id")
    .notNull()
    .references(() => verificationCasesTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVerificationCaseSchema = createInsertSchema(verificationCasesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationAttestationSchema = createInsertSchema(
  verificationAttestationsTable,
).omit({ id: true });

export type VerificationCase = typeof verificationCasesTable.$inferSelect;
export type VerificationAttestation = typeof verificationAttestationsTable.$inferSelect;
export type AdminReviewSession = typeof adminReviewSessionsTable.$inferSelect;
export type InsertVerificationCase = z.infer<typeof insertVerificationCaseSchema>;
