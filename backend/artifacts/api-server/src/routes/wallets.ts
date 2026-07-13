import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  walletsTable,
  organizationsTable,
  organizationMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { getWallet, getWalletBalances, initiateTransfer } from "../lib/circle";
import { getWalletPolicy } from "../lib/policy";

const router: IRouter = Router();

// GET /organizations/:orgId/wallet
router.get(
  "/organizations/:orgId/wallet",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    const [membership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!membership) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }

    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(
        and(
          eq(walletsTable.organizationId, orgId),
          eq(walletsTable.purpose, "TREASURY"),
        ),
      )
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "Wallet not found for this organization" });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    // Get live balance from Circle
    let balances: Array<{ amount: string; currency: string }> = [];
    try {
      const circleBalances = await getWalletBalances(wallet.circleWalletId);
      balances = circleBalances.map((b) => ({
        amount: b.amount,
        currency: b.token?.symbol ?? "USDC",
      }));
    } catch (err) {
      req.log.warn({ err }, "Failed to fetch Circle wallet balance");
    }

    const policy = getWalletPolicy(
      (org?.verificationStatus ?? "UNVERIFIED") as any,
    );

    res.json({
      id: wallet.id,
      organizationId: wallet.organizationId,
      circleWalletId: wallet.circleWalletId,
      blockchainAddress: wallet.blockchainAddress,
      chain: wallet.chain,
      walletType: wallet.walletType,
      purpose: wallet.purpose,
      balances,
      policy,
      createdAt: wallet.createdAt,
    });
  },
);

// POST /organizations/:orgId/wallet/transfer
router.post(
  "/organizations/:orgId/wallet/transfer",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    const [membership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!membership) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }

    // Must be authorized signer + FINANCE or higher
    if (!membership.isAuthorizedSigner) {
      res.status(403).json({ error: "Only authorized signers can initiate transfers" });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    const policy = getWalletPolicy((org?.verificationStatus ?? "UNVERIFIED") as any);
    if (!policy.canWithdraw) {
      res.status(403).json({
        error: `Transfer not allowed for org status: ${org?.verificationStatus}`,
      });
      return;
    }

    const { amount, currency, destinationAddress, destinationChain, idempotencyKey } =
      req.body as {
        amount?: string;
        currency?: string;
        destinationAddress?: string;
        destinationChain?: string;
        idempotencyKey?: string;
      };

    if (!amount || !destinationAddress || !destinationChain) {
      res.status(400).json({ error: "amount, destinationAddress, and destinationChain are required" });
      return;
    }

    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(
        and(
          eq(walletsTable.organizationId, orgId),
          eq(walletsTable.purpose, "TREASURY"),
        ),
      )
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    const transfer = await initiateTransfer({
      sourceWalletId: wallet.circleWalletId,
      destinationAddress,
      blockchain: destinationChain,
      amount,
      idempotencyKey,
    });

    res.status(202).json({ transferId: transfer.id, status: transfer.state });
  },
);

export default router;
