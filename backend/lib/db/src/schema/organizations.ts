import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const verificationStatusEnum = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const;

export const orgMemberRoleEnum = ["OWNER", "ADMIN", "FINANCE", "MEMBER"] as const;

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  tradingName: text("trading_name"),
  country: text("country").notNull(),
  industry: text("industry").notNull(),
  regionsServed: text("regions_served").array().notNull().default([]),
  // encrypted at rest - we store the cipher text
  registrationNumber: text("registration_number"),
  taxId: text("tax_id"),
  verificationStatus: text("verification_status")
    .notNull()
    .default("UNVERIFIED"),
  publicProfile: jsonb("public_profile"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembersTable = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("MEMBER"),
  isAuthorizedSigner: boolean("is_authorized_signer").notNull().default(false),
  invitedBy: uuid("invited_by").references(() => usersTable.id),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true,
  verificationStatus: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrgMemberSchema = createInsertSchema(organizationMembersTable).omit({
  id: true,
  joinedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
