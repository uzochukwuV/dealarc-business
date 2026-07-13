import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const connectionsTable = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestingOrgId: uuid("requesting_org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  targetOrgId: uuid("target_org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  reason: text("reason"),
  proposedDealCategory: text("proposed_deal_category"),
  approxValue: text("approx_value"),
  timeline: text("timeline"),
  requiresNda: boolean("requires_nda").notNull().default(false),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export const insertConnectionSchema = createInsertSchema(connectionsTable).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
  status: true,
});

export type Connection = typeof connectionsTable.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
