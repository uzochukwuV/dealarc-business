import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  connectionsTable,
  organizationMembersTable,
  dealWorkspacesTable,
  workspaceMembersTable,
} from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

function buildWorkspaceMemberValues(membership: { role: string; isAuthorizedSigner: boolean }) {
  return {
    orgRole: membership.role,
    canPropose: ["OWNER", "ADMIN"].includes(membership.role),
    canApproveTerms: ["OWNER", "ADMIN", "FINANCE"].includes(membership.role),
    canSign: membership.isAuthorizedSigner,
    canFund: ["OWNER", "FINANCE"].includes(membership.role),
  };
}

async function isMemberOfOrg(userId: string, orgId: string) {
  const [membership] = await db
    .select({ id: organizationMembersTable.id, role: organizationMembersTable.role, isAuthorizedSigner: organizationMembersTable.isAuthorizedSigner })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.organizationId, orgId),
        eq(organizationMembersTable.userId, userId),
      ),
    )
    .limit(1);

  return membership ?? null;
}

// GET /connections
router.get("/connections", authenticate, async (req, res): Promise<void> => {
  const myMemberships = await db
    .select({ organizationId: organizationMembersTable.organizationId })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.userId, req.user!.sub));

  const myOrgIds = myMemberships.map((membership) => membership.organizationId);
  if (myOrgIds.length === 0) {
    res.json([]);
    return;
  }

  const allConnections = await db.select().from(connectionsTable);
  const filtered = allConnections.filter(
    (connection) =>
      myOrgIds.includes(connection.requestingOrgId) || myOrgIds.includes(connection.targetOrgId),
  );

  res.json(filtered);
});

// POST /connections
router.post("/connections", authenticate, async (req, res): Promise<void> => {
  const {
    requestingOrgId,
    targetOrgId,
    reason,
    proposedDealCategory,
    approxValue,
    timeline,
    requiresNda,
  } = req.body as {
    requestingOrgId?: string;
    targetOrgId?: string;
    reason?: string;
    proposedDealCategory?: string;
    approxValue?: string;
    timeline?: string;
    requiresNda?: boolean;
  };

  if (!requestingOrgId || !targetOrgId) {
    res.status(400).json({ error: "requestingOrgId and targetOrgId are required" });
    return;
  }

  const membership = await isMemberOfOrg(req.user!.sub, requestingOrgId);
  if (!membership) {
    res.status(403).json({ error: "Not a member of the requesting organization" });
    return;
  }

  const [connection] = await db
    .insert(connectionsTable)
    .values({
      requestingOrgId,
      targetOrgId,
      reason: reason ?? null,
      proposedDealCategory: proposedDealCategory ?? null,
      approxValue: approxValue ?? null,
      timeline: timeline ?? null,
      requiresNda: requiresNda ?? false,
    })
    .returning();

  res.status(201).json(connection);
});

// GET /connections/:connectionId
router.get("/connections/:connectionId", authenticate, async (req, res): Promise<void> => {
  const connectionId = Array.isArray(req.params.connectionId)
    ? req.params.connectionId[0]
    : req.params.connectionId;

  const [connection] = await db
    .select()
    .from(connectionsTable)
    .where(eq(connectionsTable.id, connectionId))
    .limit(1);

  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const requestingMembership = await isMemberOfOrg(req.user!.sub, connection.requestingOrgId);
  const targetMembership = await isMemberOfOrg(req.user!.sub, connection.targetOrgId);
  if (!requestingMembership && !targetMembership) {
    res.status(403).json({ error: "Not authorized to view this connection" });
    return;
  }

  res.json(connection);
});

// POST /connections/:connectionId/respond
router.post(
  "/connections/:connectionId/respond",
  authenticate,
  async (req, res): Promise<void> => {
    const connectionId = Array.isArray(req.params.connectionId)
      ? req.params.connectionId[0]
      : req.params.connectionId;

    const { response, createWorkspace } = req.body as {
      response?: "ACCEPTED" | "DECLINED" | "PROFILE_ONLY" | "MORE_INFO";
      createWorkspace?: boolean;
    };

    if (!response || !["ACCEPTED", "DECLINED", "PROFILE_ONLY", "MORE_INFO"].includes(response)) {
      res.status(400).json({ error: "response must be ACCEPTED, DECLINED, PROFILE_ONLY, or MORE_INFO" });
      return;
    }

    const [connection] = await db
      .select()
      .from(connectionsTable)
      .where(eq(connectionsTable.id, connectionId))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const membership = await isMemberOfOrg(req.user!.sub, connection.targetOrgId);
    if (!membership) {
      res.status(403).json({ error: "Not authorized to respond to this connection" });
      return;
    }

    const [updated] = await db
      .update(connectionsTable)
      .set({ status: response, respondedAt: new Date() })
      .where(eq(connectionsTable.id, connectionId))
      .returning();

    if (response === "ACCEPTED" && createWorkspace) {
      const [workspace] = await db
        .insert(dealWorkspacesTable)
        .values({
          connectionId: connection.id,
          title: `Deal: ${connection.requestingOrgId} -> ${connection.targetOrgId}`,
          status: "WORKSPACE_ACTIVE",
          participantOrgIds: [connection.requestingOrgId, connection.targetOrgId],
        })
        .returning();

      const participantMemberships = await db
        .select()
        .from(organizationMembersTable)
        .where(
          or(
            eq(organizationMembersTable.organizationId, connection.requestingOrgId),
            eq(organizationMembersTable.organizationId, connection.targetOrgId),
          ),
        );

      for (const participantMembership of participantMemberships) {
        await db.insert(workspaceMembersTable).values({
          workspaceId: workspace.id,
          organizationId: participantMembership.organizationId,
          userId: participantMembership.userId,
          ...buildWorkspaceMemberValues(participantMembership),
        });
      }

      res.json({ ...updated, workspace });
      return;
    }

    res.json(updated);
  },
);

export default router;
