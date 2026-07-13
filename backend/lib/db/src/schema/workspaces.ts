import { pgTable, text, uuid, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { connectionsTable } from "./connections";
import { usersTable } from "./users";

export const dealWorkspacesTable = pgTable("deal_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => connectionsTable.id),
  title: text("title").notNull(),
  objectiveSummary: text("objective_summary"),
  status: text("status").notNull().default("WORKSPACE_ACTIVE"),
  participantOrgIds: uuid("participant_org_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembersTable = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  orgRole: text("org_role").notNull().default("MEMBER"),
  canPropose: boolean("can_propose").notNull().default(false),
  canApproveTerms: boolean("can_approve_terms").notNull().default(false),
  canSign: boolean("can_sign").notNull().default(false),
  canFund: boolean("can_fund").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  senderUserId: uuid("sender_user_id")
    .notNull()
    .references(() => usersTable.id),
  senderOrgId: uuid("sender_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  body: text("body").notNull(),
  linkedObjectType: text("linked_object_type"),
  linkedObjectId: uuid("linked_object_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceActivityLogsTable = pgTable("workspace_activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => dealWorkspacesTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  actorOrgId: uuid("actor_org_id")
    .notNull()
    .references(() => organizationsTable.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(dealWorkspacesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembersTable).omit({
  id: true,
  addedAt: true,
});
export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export const insertActivityLogSchema = createInsertSchema(workspaceActivityLogsTable).omit({
  id: true,
  createdAt: true,
});

export type DealWorkspace = typeof dealWorkspacesTable.$inferSelect;
export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type WorkspaceActivityLog = typeof workspaceActivityLogsTable.$inferSelect;
