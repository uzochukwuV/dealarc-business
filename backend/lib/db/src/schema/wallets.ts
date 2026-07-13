import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const walletsTable = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  circleWalletId: text("circle_wallet_id").notNull(),
  circleWalletSetId: text("circle_wallet_set_id"),
  blockchainAddress: text("blockchain_address"),
  chain: text("chain").notNull().default("MATIC-AMOY"),
  walletType: text("wallet_type").notNull().default("DEVELOPER_CONTROLLED"),
  purpose: text("purpose").notNull().default("TREASURY"),
  // On-chain identity registration
  onChainIdentityId: text("on_chain_identity_id"),   // uint256 returned by Identity.registerIdentity
  identityTxHash:    text("identity_tx_hash"),        // tx hash of the registerIdentity call
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
});

export type Wallet = typeof walletsTable.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
