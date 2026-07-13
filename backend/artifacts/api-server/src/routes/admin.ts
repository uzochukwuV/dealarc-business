import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  verificationCasesTable,
  verificationAttestationsTable,
  organizationsTable,
  documentRefsTable,
  adminDocumentAccessLogsTable,
  adminReviewSessionsTable,
  disputeDocGrantsTable,
  disputesTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { createDeveloperWalletSet, createPlatformWallet } from "../lib/circle";

const router: IRouter = Router();

// Simple admin check — in production this would check an admin role table
// For MVP: admin users are identified by a ADMIN_USER_IDS env var (comma-separated)
function isAdmin(userId: string): boolean {
  const adminIds = process.env.ADMIN_USER_IDS;
  if (!adminIds) return false;
  return adminIds.split(",").map((s) => s.trim()).includes(userId);
}

function requireAdmin(req: any, res: any): boolean {
  if (!isAdmin(req.user?.sub)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// ── GET /admin/verification-cases ─────────────────────────────────────────────
router.get("/admin/verification-cases", authenticate, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { status } = req.query as { status?: string };

  const cases = await (status
    ? db
        .select()
        .from(verificationCasesTable)
        .where(eq(verificationCasesTable.status, status))
    : db.select().from(verificationCasesTable));

  res.json(cases);
});

// ── GET /admin/verification-cases/:caseId ─────────────────────────────────────
// Returns case metadata always. Returns associated documents only when the
// admin has an active time-boxed review session for this case.
router.get(
  "/admin/verification-cases/:caseId",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    const caseId = Array.isArray(req.params.caseId)
      ? req.params.caseId[0]
      : req.params.caseId;

    const [verCase] = await db
      .select()
      .from(verificationCasesTable)
      .where(eq(verificationCasesTable.id, caseId))
      .limit(1);

    if (!verCase) {
      res.status(404).json({ error: "Verification case not found" });
      return;
    }

    // Check for an active review session
    const now = new Date();
    const [activeSession] = await db
      .select()
      .from(adminReviewSessionsTable)
      .where(
        and(
          eq(adminReviewSessionsTable.adminId, req.user!.sub),
          eq(adminReviewSessionsTable.caseId, caseId),
          gt(adminReviewSessionsTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (!activeSession) {
      // Return metadata only — documents require an open session
      res.json({
        ...verCase,
        documents: null,
        requiresSession: true,
        message: "Open a review session via POST /admin/verification-cases/:caseId/open-session to view documents",
      });
      return;
    }

    // Session active — fetch and log document access
    const documents = await db
      .select()
      .from(documentRefsTable)
      .where(eq(documentRefsTable.organizationId, verCase.organizationId));

    await Promise.all(
      documents.map((doc) =>
        db.insert(adminDocumentAccessLogsTable).values({
          adminId: req.user!.sub,
          documentId: doc.id,
          reason: "verification_review",
          context: `caseId=${caseId} sessionId=${activeSession.id}`,
        }),
      ),
    );

    res.json({ ...verCase, documents, sessionExpiresAt: activeSession.expiresAt });
  },
);

// ── POST /admin/verification-cases/:caseId/open-session ───────────────────────
// Creates a 2-hour time-boxed review session granting this admin decrypt
// access to the case's documents via GET /documents/:docId/download.
router.post(
  "/admin/verification-cases/:caseId/open-session",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    const caseId = Array.isArray(req.params.caseId)
      ? req.params.caseId[0]
      : req.params.caseId;

    const [verCase] = await db
      .select()
      .from(verificationCasesTable)
      .where(eq(verificationCasesTable.id, caseId))
      .limit(1);

    if (!verCase) {
      res.status(404).json({ error: "Verification case not found" });
      return;
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    const [session] = await db
      .insert(adminReviewSessionsTable)
      .values({
        adminId: req.user!.sub,
        caseId,
        expiresAt,
      })
      .returning();

    res.status(201).json({
      sessionId: session.id,
      caseId,
      expiresAt,
      message: "Review session opened. Document decrypt access granted for 2 hours.",
    });
  },
);

// ── POST /admin/verification-cases/:caseId/decide ─────────────────────────────
router.post(
  "/admin/verification-cases/:caseId/decide",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    const caseId = Array.isArray(req.params.caseId)
      ? req.params.caseId[0]
      : req.params.caseId;

    const { decision, notes } = req.body as {
      decision?: "APPROVED" | "REJECTED" | "MORE_INFO_NEEDED";
      notes?: string;
    };

    if (!decision || !["APPROVED", "REJECTED", "MORE_INFO_NEEDED"].includes(decision)) {
      res.status(400).json({ error: "decision must be APPROVED, REJECTED, or MORE_INFO_NEEDED" });
      return;
    }

    const [verCase] = await db
      .select()
      .from(verificationCasesTable)
      .where(eq(verificationCasesTable.id, caseId))
      .limit(1);

    if (!verCase) {
      res.status(404).json({ error: "Verification case not found" });
      return;
    }

    const [updatedCase] = await db
      .update(verificationCasesTable)
      .set({
        status: decision,
        reviewerAdminId: req.user!.sub,
        decisionNotes: notes ?? null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(verificationCasesTable.id, caseId))
      .returning();

    // Update org verification status
    const orgStatusMap: Record<string, string> = {
      APPROVED: "VERIFIED",
      REJECTED: "REJECTED",
      MORE_INFO_NEEDED: "PENDING",
    };

    await db
      .update(organizationsTable)
      .set({ verificationStatus: orgStatusMap[decision], updatedAt: new Date() })
      .where(eq(organizationsTable.id, verCase.organizationId));

    // Issue VerificationAttestation on APPROVE
    if (decision === "APPROVED") {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await db.insert(verificationAttestationsTable).values({
        organizationId: verCase.organizationId,
        claim: "KYB_VERIFIED",
        issuer: "platform-admin",
        reviewerId: req.user!.sub,
        issuedAt: new Date(),
        expiresAt,
        revoked: false,
      });
    }

    res.json(updatedCase);
  },
);

// ── POST /admin/disputes/:disputeId/assign-arbitrator ─────────────────────────
// Assigns an arbitrator to an open dispute and creates a 7-day scoped
// document access grant for that arbitrator (Evidence + Agreement docs only).
router.post(
  "/admin/disputes/:disputeId/assign-arbitrator",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    const disputeId = Array.isArray(req.params.disputeId)
      ? req.params.disputeId[0]
      : req.params.disputeId;

    const { arbitratorId } = req.body as { arbitratorId?: string };
    if (!arbitratorId) {
      res.status(400).json({ error: "arbitratorId is required" });
      return;
    }

    const [dispute] = await db
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.id, disputeId))
      .limit(1);

    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    // Update dispute with arbitratorId
    const [updated] = await db
      .update(disputesTable)
      .set({ arbitratorId, status: "UNDER_REVIEW" })
      .where(eq(disputesTable.id, disputeId))
      .returning();

    // Create a 7-day scoped document grant for the arbitrator
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [grant] = await db
      .insert(disputeDocGrantsTable)
      .values({
        disputeId,
        workspaceId: dispute.workspaceId,
        granteeId: arbitratorId,
        expiresAt,
      })
      .returning();

    res.json({
      dispute: updated,
      documentGrant: {
        grantId: grant.id,
        granteeId: arbitratorId,
        workspaceId: dispute.workspaceId,
        expiresAt,
        message: "Arbitrator has scoped document access for 7 days (Evidence + Agreement in this workspace only).",
      },
    });
  },
);

// ── POST /admin/setup/circle ───────────────────────────────────────────────────
// One-time setup: creates a developer-controlled wallet set in Circle.
// Save the returned walletSetId as CIRCLE_DEV_WALLET_SET_ID secret.
router.post(
  "/admin/setup/circle",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    try {
      const walletSet = await createDeveloperWalletSet("B2B Platform Developer Wallets");
      res.json({
        message: "Developer wallet set created. Save walletSetId as CIRCLE_DEV_WALLET_SET_ID secret.",
        walletSet,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  },
);

// ── POST /admin/setup/platform-wallets ────────────────────────────────────────
// One-time: provisions PLATFORM_FEE_TREASURY and PLATFORM_AUTOMATION wallets.
// Save the returned wallet IDs as env secrets for downstream transfer routing.
router.post(
  "/admin/setup/platform-wallets",
  authenticate,
  async (req, res): Promise<void> => {
    if (!requireAdmin(req, res)) return;

    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const purpose of ["PLATFORM_FEE_TREASURY", "PLATFORM_AUTOMATION"] as const) {
      try {
        const wallet = await createPlatformWallet(purpose);
        results[purpose] = wallet;
      } catch (err) {
        errors[purpose] = err instanceof Error ? err.message : String(err);
      }
    }

    res.json({
      message: "Save each circleWalletId as PLATFORM_FEE_TREASURY_WALLET_ID / PLATFORM_AUTOMATION_WALLET_ID env secrets.",
      wallets: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  },
);

export default router;
