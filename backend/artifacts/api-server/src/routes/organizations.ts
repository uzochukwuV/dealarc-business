import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable,
  organizationMembersTable,
  usersTable,
  walletsTable,
  verificationAttestationsTable,
} from "@workspace/db";
import { eq, and, asc, desc, ilike, or } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { createOrgWallet } from "../lib/circle";
import { getOrgReputation, registerOrgIdentity } from "../lib/blockchain";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const EMPTY_REPUTATION = {
  completedDeals: "0",
  disputedDeals: "0",
  financedDeals: "0",
  totalVolume: "0",
  score: "0",
};

async function buildOrganizationStats(orgId: string) {
  const [attestation] = await db
    .select({
      issuedAt: verificationAttestationsTable.issuedAt,
      expiresAt: verificationAttestationsTable.expiresAt,
    })
    .from(verificationAttestationsTable)
    .where(
      and(
        eq(verificationAttestationsTable.organizationId, orgId),
        eq(verificationAttestationsTable.revoked, false),
      ),
    )
    .orderBy(desc(verificationAttestationsTable.issuedAt))
    .limit(1);

  const wallets = await db
    .select({ onChainIdentityId: walletsTable.onChainIdentityId })
    .from(walletsTable)
    .where(eq(walletsTable.organizationId, orgId));

  const identityId = wallets.find((wallet) => wallet.onChainIdentityId)?.onChainIdentityId ?? null;

  let reputation = EMPTY_REPUTATION;
  if (identityId) {
    try {
      reputation = await getOrgReputation(identityId);
    } catch (error) {
      logger.warn({ err: error, orgId, identityId }, "Failed to load on-chain reputation");
    }
  }

  return {
    identityId,
    verifiedAt: attestation?.issuedAt ?? null,
    verificationExpiresAt: attestation?.expiresAt ?? null,
    reputation,
  };
}

// ── POST /organizations ────────────────────────────────────────────────────────
// Creates the org, adds the creator as OWNER, then provisions (all best-effort):
//   1. Circle developer-controlled wallet  (platform controller for automation)
//   2. On-chain identity registration      (Identity contract → stores identityId)
router.post("/organizations", authenticate, async (req, res): Promise<void> => {
  const { legalName, tradingName, country, industry, regionsServed, publicProfile } =
    req.body as {
      legalName?: string;
      tradingName?: string;
      country?: string;
      industry?: string;
      regionsServed?: string[];
      publicProfile?: object;
    };

  if (!legalName || !country || !industry) {
    res.status(400).json({ error: "legalName, country, and industry are required" });
    return;
  }

  // 1. Create the org record
  const [org] = await db
    .insert(organizationsTable)
    .values({
      legalName,
      tradingName: tradingName ?? null,
      country,
      industry,
      regionsServed: regionsServed ?? [],
      publicProfile: publicProfile ?? null,
      verificationStatus: "UNVERIFIED",
    })
    .returning();

  // 2. Add creator as OWNER
  await db.insert(organizationMembersTable).values({
    organizationId: org.id,
    userId: req.user!.sub,
    role: "OWNER",
    isAuthorizedSigner: true,
  });

  // 3. Provision Circle platform-controller wallet + on-chain identity (best-effort)
  const provisioningResult = {
    walletProvisioned: false,
    identityRegistered: false,
    circleWalletId: null as string | null,
    blockchainAddress: null as string | null,
    onChainIdentityId: null as string | null,
    identityTxHash: null as string | null,
    errors: [] as string[],
  };

  // Step 3a — Circle developer-controlled wallet
  let circleWallet: Awaited<ReturnType<typeof createOrgWallet>> | null = null;
  try {
    circleWallet = await createOrgWallet(org.id);
    provisioningResult.walletProvisioned = true;
    provisioningResult.circleWalletId = circleWallet.id;
    provisioningResult.blockchainAddress = circleWallet.address ?? null;
    req.log.info(
      { orgId: org.id, walletId: circleWallet.id, address: circleWallet.address },
      "Circle platform-controller wallet provisioned",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    provisioningResult.errors.push(`Circle wallet: ${msg}`);
    req.log.warn({ err, orgId: org.id }, "Circle wallet provisioning failed");
  }

  // Step 3b — On-chain identity registration (requires wallet address as identity owner)
  if (circleWallet?.address) {
    try {
      const { identityId, txHash } = await registerOrgIdentity(org.id, circleWallet.address);
      provisioningResult.identityRegistered = true;
      provisioningResult.onChainIdentityId = identityId;
      provisioningResult.identityTxHash = txHash;
      req.log.info(
        { orgId: org.id, identityId, txHash },
        "On-chain identity registered",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      provisioningResult.errors.push(`Identity registration: ${msg}`);
      req.log.warn({ err, orgId: org.id }, "On-chain identity registration failed");
    }
  } else if (!circleWallet) {
    // Can't register identity without a wallet address — skip with warning
    provisioningResult.errors.push(
      "Identity registration skipped: no Circle wallet address available",
    );
  }

  // Step 3c — Persist wallet + identity data to DB (only if wallet was created)
  if (circleWallet) {
    try {
      await db.insert(walletsTable).values({
        organizationId: org.id,
        circleWalletId: circleWallet.id,
        circleWalletSetId: circleWallet.walletSetId ?? null,
        blockchainAddress: circleWallet.address ?? "",
        chain: circleWallet.blockchain ?? "MATIC-AMOY",
        walletType: "DEVELOPER_CONTROLLED",
        purpose: "TREASURY",
        onChainIdentityId: provisioningResult.onChainIdentityId,
        identityTxHash: provisioningResult.identityTxHash,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      provisioningResult.errors.push(`DB wallet insert: ${msg}`);
      req.log.error({ err, orgId: org.id }, "Failed to persist wallet record");
    }
  }

  res.status(201).json({
    ...org,
    provisioning: provisioningResult,
  });
});

// ── GET /organizations/:orgId ─────────────────────────────────────────────────
// ?? GET /organizations ???????????????????????????????????????????????????????
router.get("/organizations", authenticate, async (req, res): Promise<void> => {
  const { q, country, industry, verificationStatus, verifiedOnly, limit, offset } =
    req.query as {
      q?: string;
      country?: string;
      industry?: string;
      verificationStatus?: string;
      verifiedOnly?: string;
      limit?: string;
      offset?: string;
    };

  const normalizedLimit = Number(limit ?? 20);
  const normalizedOffset = Number(offset ?? 0);
  const pageSize = Number.isFinite(normalizedLimit) ? Math.min(Math.max(normalizedLimit, 1), 50) : 20;
  const pageOffset = Number.isFinite(normalizedOffset) ? Math.max(normalizedOffset, 0) : 0;

  const filters = [];
  if (q?.trim()) {
    const search = "%" + q.trim() + "%";
    filters.push(
      or(
        ilike(organizationsTable.legalName, search),
        ilike(organizationsTable.tradingName, search),
      ),
    );
  }
  if (country?.trim()) {
    filters.push(eq(organizationsTable.country, country.trim()));
  }
  if (industry?.trim()) {
    filters.push(eq(organizationsTable.industry, industry.trim()));
  }
  if (verificationStatus?.trim()) {
    filters.push(eq(organizationsTable.verificationStatus, verificationStatus.trim()));
  }
  if (verifiedOnly === "true") {
    filters.push(eq(organizationsTable.verificationStatus, "VERIFIED"));
  }

  const orgQuery = db.select().from(organizationsTable);
  const orgs = await (filters.length > 0
    ? orgQuery
        .where(and(...filters))
        .orderBy(asc(organizationsTable.legalName))
        .limit(pageSize)
        .offset(pageOffset)
    : orgQuery.orderBy(asc(organizationsTable.legalName)).limit(pageSize).offset(pageOffset));

  const results = await Promise.all(
    orgs.map(async (org) => ({
      ...org,
      stats: await buildOrganizationStats(org.id),
    })),
  );

  res.json(results);
});

router.get("/organizations/:orgId", authenticate, async (req, res): Promise<void> => {
  const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

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
    res.json(org);
    return;
  }

  const wallets = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.organizationId, orgId));

  res.json({ ...org, wallets });
});

// ?? GET /organizations/:orgId/stats ???????????????????????????????????????????
router.get("/organizations/:orgId/stats", authenticate, async (req, res): Promise<void> => {
  const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json({
    ...org,
    stats: await buildOrganizationStats(org.id),
  });
});

router.patch("/organizations/:orgId", authenticate, async (req, res): Promise<void> => {
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

  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    res.status(403).json({ error: "Not authorized to update this organization" });
    return;
  }

  const { tradingName, regionsServed, publicProfile } = req.body as {
    tradingName?: string;
    regionsServed?: string[];
    publicProfile?: object;
  };

  const [updated] = await db
    .update(organizationsTable)
    .set({
      ...(tradingName !== undefined && { tradingName }),
      ...(regionsServed !== undefined && { regionsServed }),
      ...(publicProfile !== undefined && { publicProfile }),
      updatedAt: new Date(),
    })
    .where(eq(organizationsTable.id, orgId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(updated);
});

// ── DELETE /organizations/:orgId ──────────────────────────────────────────────
router.delete("/organizations/:orgId", authenticate, async (req, res): Promise<void> => {
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

  if (!membership || membership.role !== "OWNER") {
    res.status(403).json({ error: "Only the org owner can delete the organization" });
    return;
  }

  await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
  res.sendStatus(204);
});

// ── GET /organizations/:orgId/members ─────────────────────────────────────────
router.get(
  "/organizations/:orgId/members",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    const members = await db
      .select({
        id: organizationMembersTable.id,
        userId: organizationMembersTable.userId,
        role: organizationMembersTable.role,
        isAuthorizedSigner: organizationMembersTable.isAuthorizedSigner,
        joinedAt: organizationMembersTable.joinedAt,
        revokedAt: organizationMembersTable.revokedAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
      .from(organizationMembersTable)
      .leftJoin(usersTable, eq(organizationMembersTable.userId, usersTable.id))
      .where(eq(organizationMembersTable.organizationId, orgId));

    res.json(members);
  },
);

// ── POST /organizations/:orgId/members ────────────────────────────────────────
router.post(
  "/organizations/:orgId/members",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Not authorized to add members" });
      return;
    }

    const { userId, role, isAuthorizedSigner } = req.body as {
      userId?: string;
      role?: string;
      isAuthorizedSigner?: boolean;
    };

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const [member] = await db
      .insert(organizationMembersTable)
      .values({
        organizationId: orgId,
        userId,
        role: role ?? "MEMBER",
        isAuthorizedSigner: isAuthorizedSigner ?? false,
        invitedBy: req.user!.sub,
      })
      .returning();

    res.status(201).json(member);
  },
);

// ── PATCH /organizations/:orgId/members/:memberId ─────────────────────────────
router.patch(
  "/organizations/:orgId/members/:memberId",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId    = Array.isArray(req.params.orgId)    ? req.params.orgId[0]    : req.params.orgId;
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Not authorized to update members" });
      return;
    }

    const { role, isAuthorizedSigner } = req.body as {
      role?: string;
      isAuthorizedSigner?: boolean;
    };

    const [updated] = await db
      .update(organizationMembersTable)
      .set({
        ...(role !== undefined && { role }),
        ...(isAuthorizedSigner !== undefined && { isAuthorizedSigner }),
      })
      .where(eq(organizationMembersTable.id, memberId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    res.json(updated);
  },
);

// ── DELETE /organizations/:orgId/members/:memberId ────────────────────────────
router.delete(
  "/organizations/:orgId/members/:memberId",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId    = Array.isArray(req.params.orgId)    ? req.params.orgId[0]    : req.params.orgId;
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Not authorized to remove members" });
      return;
    }

    await db
      .update(organizationMembersTable)
      .set({ revokedAt: new Date() })
      .where(eq(organizationMembersTable.id, memberId));

    res.sendStatus(204);
  },
);

export default router;
