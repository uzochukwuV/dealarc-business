import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  verificationCasesTable,
  verificationAttestationsTable,
  organizationsTable,
  organizationMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

// GET /organizations/:orgId/verification-cases
router.get(
  "/organizations/:orgId/verification-cases",
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

    const cases = await db
      .select()
      .from(verificationCasesTable)
      .where(eq(verificationCasesTable.organizationId, orgId));

    res.json(cases);
  },
);

// POST /organizations/:orgId/verification-cases
router.post(
  "/organizations/:orgId/verification-cases",
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

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      res.status(403).json({ error: "Only OWNER or ADMIN can submit verification" });
      return;
    }

    const [verCase] = await db
      .insert(verificationCasesTable)
      .values({ organizationId: orgId, status: "SUBMITTED" })
      .returning();

    // Update org status to PENDING
    await db
      .update(organizationsTable)
      .set({ verificationStatus: "PENDING", updatedAt: new Date() })
      .where(eq(organizationsTable.id, orgId));

    res.status(201).json(verCase);
  },
);

// GET /organizations/:orgId/attestation
router.get(
  "/organizations/:orgId/attestation",
  authenticate,
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    const [attestation] = await db
      .select()
      .from(verificationAttestationsTable)
      .where(
        and(
          eq(verificationAttestationsTable.organizationId, orgId),
          eq(verificationAttestationsTable.revoked, false),
        ),
      )
      .limit(1);

    if (!attestation) {
      res.status(404).json({ error: "No active attestation found" });
      return;
    }

    res.json(attestation);
  },
);

export default router;
