import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  dealWorkspacesTable,
  workspaceMembersTable,
  messagesTable,
  requirementsTable,
  proposalsTable,
  termSheetsTable,
  approvalRequestsTable,
  agreementsTable,
  dealContractsTable,
  milestonesTable,
  evidenceTable,
  disputesTable,
  reputationRecordsTable,
  workspaceActivityLogsTable,
  organizationMembersTable,
  documentRefsTable,
  walletsTable,
  organizationsTable,
  disputeDocGrantsTable,
} from "@workspace/db";
import { eq, and, gt, inArray, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { encryptDocument } from "../lib/encryption";
import { pinEncryptedFile } from "../lib/pinata";
import { requireKybVerified, PolicyError } from "../lib/policy";
import { deployDealContract, readAgreementSnapshot, readEscrowSplitSnapshot, createEscrowDeal, addEscrowMilestones, fundEscrowDeal, approveEscrowMilestone, releaseEscrowMilestone } from "../lib/blockchain";
import crypto from "node:crypto";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    )
    .limit(1);
  return member ?? null;
}

async function logActivity(
  workspaceId: string,
  actorId: string,
  actorOrgId: string,
  action: string,
  metadata?: object,
) {
  await db.insert(workspaceActivityLogsTable).values({
    workspaceId,
    actorId,
    actorOrgId,
    action,
    metadata: metadata ?? null,
  });
}

async function updateWorkspaceStatus(workspaceId: string, status: string) {
  await db
    .update(dealWorkspacesTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(dealWorkspacesTable.id, workspaceId));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /workspaces
router.get('/workspaces', authenticate, async (req, res): Promise<void> => {
  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, req.user!.sub));

  const workspaceIds = [...new Set(memberships.map((m) => m.workspaceId))];
  if (workspaceIds.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select()
    .from(dealWorkspacesTable)
    .where(inArray(dealWorkspacesTable.id, workspaceIds))
    .orderBy(desc(dealWorkspacesTable.createdAt));

  res.json(await Promise.all(rows.map((workspace) => hydrateWorkspace(workspace))));
});

// POST /workspaces
router.post("/workspaces", authenticate, async (req, res): Promise<void> => {
  const { connectionId, title, objectiveSummary } = req.body as {
    connectionId?: string;
    title?: string;
    objectiveSummary?: string;
  };

  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const [workspace] = await db
    .insert(dealWorkspacesTable)
    .values({
      connectionId: connectionId ?? null,
      title,
      objectiveSummary: objectiveSummary ?? null,
      status: "WORKSPACE_ACTIVE",
      participantOrgIds: [],
    })
    .returning();

  res.status(201).json(workspace);
});

// GET /workspaces/:workspaceId
router.get("/workspaces/:workspaceId", authenticate, async (req, res): Promise<void> => {
  const workspaceId = Array.isArray(req.params.workspaceId)
    ? req.params.workspaceId[0]
    : req.params.workspaceId;

  const [workspace] = await db
    .select()
    .from(dealWorkspacesTable)
    .where(eq(dealWorkspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  res.json(await hydrateWorkspace(workspace));
});

// GET /workspaces/:workspaceId/members
router.get(
  "/workspaces/:workspaceId/members",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const members = await db
      .select()
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.workspaceId, workspaceId));

    res.json(members);
  },
);

// POST /workspaces/:workspaceId/members
router.post(
  "/workspaces/:workspaceId/members",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { userId, organizationId, canPropose, canApproveTerms, canSign, canFund } =
      req.body as {
        userId?: string;
        organizationId?: string;
        canPropose?: boolean;
        canApproveTerms?: boolean;
        canSign?: boolean;
        canFund?: boolean;
      };

    if (!userId || !organizationId) {
      res.status(400).json({ error: "userId and organizationId are required" });
      return;
    }

    const [member] = await db
      .insert(workspaceMembersTable)
      .values({
        workspaceId,
        organizationId,
        userId,
        orgRole: "MEMBER",
        canPropose: canPropose ?? false,
        canApproveTerms: canApproveTerms ?? false,
        canSign: canSign ?? false,
        canFund: canFund ?? false,
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, organizationId, "MEMBER_ADDED", {
      memberId: member.id,
    });

    res.status(201).json(member);
  },
);

// GET /workspaces/:workspaceId/messages
router.get(
  "/workspaces/:workspaceId/messages",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.workspaceId, workspaceId));

    res.json(messages);
  },
);

// POST /workspaces/:workspaceId/messages
router.post(
  "/workspaces/:workspaceId/messages",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { body, senderOrgId } = req.body as {
      body?: string;
      senderOrgId?: string;
    };

    if (body == null || !senderOrgId) {
      res.status(400).json({ error: "body and senderOrgId are required" });
      return;
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        workspaceId,
        senderUserId: req.user!.sub,
        senderOrgId,
        body,
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, senderOrgId, "MESSAGE_SENT");

    res.status(201).json(message);
  },
);

// POST /workspaces/:workspaceId/messages/:messageId/convert
router.post(
  "/workspaces/:workspaceId/messages/:messageId/convert",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const messageId = Array.isArray(req.params.messageId)
      ? req.params.messageId[0]
      : req.params.messageId;

    const { targetType, senderOrgId, fields } = req.body as {
      targetType?: "REQUIREMENT" | "PROPOSAL";
      senderOrgId?: string;
      fields?: object;
    };

    if (!targetType || !senderOrgId) {
      res.status(400).json({ error: "targetType and senderOrgId are required" });
      return;
    }

    let objectId: string;

    if (targetType === "REQUIREMENT") {
      const [req2] = await db
        .insert(requirementsTable)
        .values({
          workspaceId,
          createdByOrgId: senderOrgId,
          fields: fields ?? {},
          status: "DRAFT",
        })
        .returning();
      objectId = req2.id;
    } else {
      const [proposal] = await db
        .insert(proposalsTable)
        .values({
          workspaceId,
          proposedByOrgId: senderOrgId,
          terms: fields ?? {},
          status: "DRAFT",
          version: 1,
        })
        .returning();
      objectId = proposal.id;
    }

    // Link the message to the created object
    await db
      .update(messagesTable)
      .set({ linkedObjectType: targetType, linkedObjectId: objectId })
      .where(eq(messagesTable.id, messageId));

    await logActivity(workspaceId, req.user!.sub, senderOrgId, `MESSAGE_CONVERTED_TO_${targetType}`);

    res.status(201).json({ objectType: targetType, objectId });
  },
);

// GET /workspaces/:workspaceId/requirements
router.get(
  "/workspaces/:workspaceId/requirements",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const requirements = await db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.workspaceId, workspaceId));

    res.json(requirements);
  },
);

// POST /workspaces/:workspaceId/requirements
router.post(
  "/workspaces/:workspaceId/requirements",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { createdByOrgId, fields } = req.body as {
      createdByOrgId?: string;
      fields?: object;
    };

    if (!createdByOrgId) {
      res.status(400).json({ error: "createdByOrgId is required" });
      return;
    }

    const [requirement] = await db
      .insert(requirementsTable)
      .values({
        workspaceId,
        createdByOrgId,
        fields: fields ?? {},
        status: "PUBLISHED",
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, createdByOrgId, "REQUIREMENT_CREATED", {
      requirementId: requirement.id,
    });

    await updateWorkspaceStatus(workspaceId, "REQUIREMENTS_DEFINED");

    res.status(201).json(requirement);
  },
);


// PATCH /workspaces/:workspaceId/requirements/:requirementId
router.patch(
  '/workspaces/:workspaceId/requirements/:requirementId',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const requirementId = Array.isArray(req.params.requirementId)
      ? req.params.requirementId[0]
      : req.params.requirementId;

    const { createdByOrgId, fields } = req.body as {
      createdByOrgId?: string;
      fields?: object;
    };

    const [updated] = await db
      .update(requirementsTable)
      .set({ createdByOrgId: createdByOrgId ?? undefined, fields: fields ?? undefined })
      .where(and(eq(requirementsTable.id, requirementId), eq(requirementsTable.workspaceId, workspaceId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Requirement not found' });
      return;
    }

    res.json(updated);
  },
);

// POST /workspaces/:workspaceId/requirements/:requirementId/lock
router.post(
  '/workspaces/:workspaceId/requirements/:requirementId/lock',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const requirementId = Array.isArray(req.params.requirementId)
      ? req.params.requirementId[0]
      : req.params.requirementId;

    const [updated] = await db
      .update(requirementsTable)
      .set({ status: 'SUPERSEDED' })
      .where(and(eq(requirementsTable.id, requirementId), eq(requirementsTable.workspaceId, workspaceId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Requirement not found' });
      return;
    }

    res.json(updated);
  },
);

// GET /workspaces/:workspaceId/proposals
router.get(
  "/workspaces/:workspaceId/proposals",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const proposals = await db
      .select()
      .from(proposalsTable)
      .where(eq(proposalsTable.workspaceId, workspaceId));

    res.json(proposals);
  },
);

// POST /workspaces/:workspaceId/proposals
router.post(
  "/workspaces/:workspaceId/proposals",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { proposedByOrgId, supersedesProposalId, requirementId, terms } = req.body as {
      proposedByOrgId?: string;
      supersedesProposalId?: string;
      requirementId?: string;
      terms?: object;
    };

    if (!proposedByOrgId) {
      res.status(400).json({ error: "proposedByOrgId is required" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership?.canPropose || membership.organizationId !== proposedByOrgId) {
      res.status(403).json({ error: "You do not have permission to propose for this workspace" });
      return;
    }

    // Compute version
    let version = 1;
    if (supersedesProposalId) {
      const [prev] = await db
        .select()
        .from(proposalsTable)
        .where(eq(proposalsTable.id, supersedesProposalId))
        .limit(1);
      if (prev) {
        version = prev.version + 1;
        // Mark previous as COUNTERED
        await db
          .update(proposalsTable)
          .set({ status: "COUNTERED" })
          .where(eq(proposalsTable.id, supersedesProposalId));
      }
    }

    const [proposal] = await db
      .insert(proposalsTable)
      .values({
        workspaceId,
        proposedByOrgId,
        supersedesProposalId: supersedesProposalId ?? null,
        requirementId: requirementId ?? null,
        terms: terms ?? {},
        status: "DRAFT",
        version,
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, proposedByOrgId, "PROPOSAL_SUBMITTED", {
      proposalId: proposal.id,
      version,
    });

    await updateWorkspaceStatus(workspaceId, "PROPOSAL_SUBMITTED");

    res.status(201).json(proposal);
  },
);

// POST /workspaces/:workspaceId/proposals/:proposalId/accept
router.post(
  "/workspaces/:workspaceId/proposals/:proposalId/accept",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const proposalId = Array.isArray(req.params.proposalId)
      ? req.params.proposalId[0]
      : req.params.proposalId;

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership?.canApproveTerms) {
      res.status(403).json({ error: "You do not have permission to approve terms" });
      return;
    }

    const [proposal] = await db
      .select()
      .from(proposalsTable)
      .where(eq(proposalsTable.id, proposalId))
      .limit(1);

    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }

    // Find the org of the accepting user
    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    // Find a org for this user in the workspace (pick first)
    const participantOrgIds = workspace.participantOrgIds as string[];
    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    if (!myMembership) {
      res.status(403).json({ error: "Not a member of any participant org" });
      return;
    }

    const acceptingOrgId = workspaceMembership.organizationId;
    const alreadyAccepted = (proposal.acceptedByOrgIds as string[]) ?? [];

    if (alreadyAccepted.includes(acceptingOrgId)) {
      res.status(409).json({ error: "Your organization has already accepted this proposal" });
      return;
    }

    const newAcceptedByOrgIds = [...alreadyAccepted, acceptingOrgId];

    // Check if all participant orgs have accepted
    const allAccepted =
      participantOrgIds.length > 0 &&
      participantOrgIds.every((id) => newAcceptedByOrgIds.includes(id));

    const newStatus = allAccepted ? "ACCEPTED" : "DRAFT";

    const [updated] = await db
      .update(proposalsTable)
      .set({ acceptedByOrgIds: newAcceptedByOrgIds, status: newStatus })
      .where(eq(proposalsTable.id, proposalId))
      .returning();

    await logActivity(workspaceId, req.user!.sub, acceptingOrgId, "PROPOSAL_ACCEPTED", {
      proposalId,
      allPartiesAccepted: allAccepted,
    });

    // If fully accepted → create TermSheet automatically
    if (allAccepted) {
      await db.insert(termSheetsTable).values({
        workspaceId,
        acceptedProposalId: proposalId,
        terms: proposal.terms,
      });

      await updateWorkspaceStatus(workspaceId, "TERMS_AGREED");

      // Create ApprovalRequest for each participant org
      for (const orgId of participantOrgIds) {
        await db.insert(approvalRequestsTable).values({
          workspaceId,
          organizationId: orgId,
          termSheetId: (
            await db
              .select()
              .from(termSheetsTable)
              .where(eq(termSheetsTable.workspaceId, workspaceId))
              .limit(1)
          )[0]?.id ?? "",
          requiredApprovers: [],
          policyTier: "STANDARD",
          status: "PENDING",
        });
      }

      await updateWorkspaceStatus(workspaceId, "INTERNAL_APPROVAL");
    }

    res.json(updated);
  },
);

// POST /workspaces/:workspaceId/proposals/:proposalId/reject
router.post(
  '/workspaces/:workspaceId/proposals/:proposalId/reject',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const proposalId = Array.isArray(req.params.proposalId)
      ? req.params.proposalId[0]
      : req.params.proposalId;

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership?.canApproveTerms) {
      res.status(403).json({ error: 'You do not have permission to reject terms' });
      return;
    }

    const [updated] = await db
      .update(proposalsTable)
      .set({ status: 'REJECTED' })
      .where(eq(proposalsTable.id, proposalId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    await logActivity(workspaceId, req.user!.sub, workspaceMembership.organizationId, 'PROPOSAL_REJECTED', { proposalId });
    res.json(updated);
  },
);


// POST /workspaces/:workspaceId/term-sheet
router.post(
  '/workspaces/:workspaceId/term-sheet',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { acceptedProposalId, terms } = req.body as {
      acceptedProposalId?: string;
      terms?: object;
    };

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    let resolvedTerms = terms ?? {};
    if (acceptedProposalId) {
      const [proposal] = await db
        .select()
        .from(proposalsTable)
        .where(eq(proposalsTable.id, acceptedProposalId))
        .limit(1);
      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }
      resolvedTerms = proposal.terms as object;
    }

    const [existing] = await db
      .select()
      .from(termSheetsTable)
      .where(eq(termSheetsTable.workspaceId, workspaceId))
      .limit(1);

    const payload = {
      workspaceId,
      acceptedProposalId: acceptedProposalId ?? existing?.acceptedProposalId ?? null,
      terms: resolvedTerms,
    };

    const result = existing
      ? (await db.update(termSheetsTable).set(payload).where(eq(termSheetsTable.id, existing.id)).returning())[0]
      : (await db.insert(termSheetsTable).values(payload).returning())[0];

    await updateWorkspaceStatus(workspaceId, 'INTERNAL_APPROVAL');
    res.status(existing ? 200 : 201).json(result);
  },
);

// GET /workspaces/:workspaceId/term-sheet
router.get(
  "/workspaces/:workspaceId/term-sheet",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [ts] = await db
      .select()
      .from(termSheetsTable)
      .where(eq(termSheetsTable.workspaceId, workspaceId))
      .limit(1);

    if (!ts) {
      res.status(404).json({ error: "No term sheet found" });
      return;
    }

    res.json(ts);
  },
);


// POST /workspaces/:workspaceId/approvals
router.post(
  '/workspaces/:workspaceId/approvals',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { organizationId, requiredApprovers, policyTier } = req.body as {
      organizationId?: string;
      requiredApprovers?: any[];
      policyTier?: string;
    };

    if (!organizationId) {
      res.status(400).json({ error: 'organizationId is required' });
      return;
    }

    const [approval] = await db
      .insert(approvalRequestsTable)
      .values({
        workspaceId,
        organizationId,
        requiredApprovers: requiredApprovers ?? [],
        policyTier: policyTier ?? 'STANDARD',
        status: 'PENDING',
        termSheetId: '',
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, organizationId, 'APPROVAL_REQUESTED', { approvalId: approval.id });
    res.status(201).json(approval);
  },
);

// GET /workspaces/:workspaceId/approvals
router.get(
  "/workspaces/:workspaceId/approvals",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const approvals = await db
      .select()
      .from(approvalRequestsTable)
      .where(eq(approvalRequestsTable.workspaceId, workspaceId));

    res.json(approvals);
  },
);

// POST /workspaces/:workspaceId/approvals/:approvalId/decide
router.post(
  "/workspaces/:workspaceId/approvals/:approvalId/decide",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const approvalId = Array.isArray(req.params.approvalId)
      ? req.params.approvalId[0]
      : req.params.approvalId;

    const { decision, notes } = req.body as {
      decision?: "APPROVED" | "REJECTED";
      notes?: string;
    };

    if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
      res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
      return;
    }

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership?.canApproveTerms) {
      res.status(403).json({ error: "You do not have permission to approve terms" });
      return;
    }

    const [requestedApproval] = await db
      .select()
      .from(approvalRequestsTable)
      .where(
        and(
          eq(approvalRequestsTable.id, approvalId),
          eq(approvalRequestsTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!requestedApproval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }

    if (requestedApproval.organizationId !== workspaceMembership.organizationId) {
      res.status(403).json({ error: "You cannot decide another organization's approval" });
      return;
    }

    const [approval] = await db
      .update(approvalRequestsTable)
      .set({ status: decision, resolvedAt: new Date() })
      .where(eq(approvalRequestsTable.id, approvalId))
      .returning();

    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }

    // Check if all approvals for this workspace are APPROVED
    const allApprovals = await db
      .select()
      .from(approvalRequestsTable)
      .where(eq(approvalRequestsTable.workspaceId, workspaceId));

    const allApproved = allApprovals.every((a) => a.status === "APPROVED");
    if (allApproved) {
      await updateWorkspaceStatus(workspaceId, "CONTRACT_SIGNED");
    }

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    await logActivity(
      workspaceId,
      req.user!.sub,
      myMembership?.organizationId ?? approval.organizationId,
      `APPROVAL_${decision}`,
      { approvalId, notes },
    );

    res.json(approval);
  },
);

// GET /workspaces/:workspaceId/agreement
router.get(
  "/workspaces/:workspaceId/agreement",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [agreement] = await db
      .select()
      .from(agreementsTable)
      .where(eq(agreementsTable.workspaceId, workspaceId))
      .limit(1);

    if (!agreement) {
      res.status(404).json({ error: "No agreement found" });
      return;
    }

    res.json(agreement);
  },
);

// POST /workspaces/:workspaceId/agreement — upload legal doc
router.post(
  "/workspaces/:workspaceId/agreement",
  authenticate,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "CONTRACT_SIGNED") {
      res.status(409).json({ error: "Agreement can only be uploaded in CONTRACT_SIGNED status" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { termSheetId } = req.body as { termSheetId?: string };
    if (!termSheetId) {
      res.status(400).json({ error: "termSheetId is required" });
      return;
    }

    const [ts] = await db
      .select()
      .from(termSheetsTable)
      .where(eq(termSheetsTable.id, termSheetId))
      .limit(1);

    if (!ts) {
      res.status(404).json({ error: "Term sheet not found" });
      return;
    }

    // Compute agreement hash from plaintext
    const agreementHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    // Encrypt + pin to IPFS
    const { encryptedBuffer, contentHash, encryptedDek, dekIv } = encryptDocument(
      req.file.buffer,
    );

    // Get org for the user
    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    const { ipfsCid } = await pinEncryptedFile(
      encryptedBuffer,
      `agreement-${workspaceId}-${Date.now()}`,
      { workspaceId, type: "AGREEMENT" },
    );

    // Store DocumentRef
    const [docRef] = await db
      .insert(documentRefsTable)
      .values({
        organizationId: myMembership?.organizationId ?? workspaceId,
        docType: "AGREEMENT",
        ipfsCid,
        contentHash,
        encryptionKeyRef: encryptedDek,
        encryptionIv: dekIv,
        uploadedBy: req.user!.sub,
      })
      .returning();

    const [agreement] = await db
      .insert(agreementsTable)
      .values({
        workspaceId,
        termSheetId,
        documentRefId: docRef.id,
        agreementHash,
        signatures: [],
        status: "DRAFTED",
      })
      .returning();

    await logActivity(
      workspaceId,
      req.user!.sub,
      myMembership?.organizationId ?? workspaceId,
      "AGREEMENT_DRAFTED",
      { agreementId: agreement.id, agreementHash },
    );

    res.status(201).json(agreement);
  },
);

// POST /workspaces/:workspaceId/agreement/sign
router.post(
  "/workspaces/:workspaceId/agreement/sign",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [agreement] = await db
      .select()
      .from(agreementsTable)
      .where(eq(agreementsTable.workspaceId, workspaceId))
      .limit(1);

    if (!agreement) {
      res.status(404).json({ error: "No agreement found" });
      return;
    }

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership?.canSign) {
      res.status(403).json({ error: "You do not have permission to sign for this workspace" });
      return;
    }

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    if (!myMembership?.isAuthorizedSigner) {
      res.status(403).json({ error: "Only authorized signers can sign agreements" });
      return;
    }

    const existingSigs = (agreement.signatures as any[]) ?? [];
    const alreadySigned = existingSigs.some((s: any) => s.userId === req.user!.sub);
    if (alreadySigned) {
      res.status(409).json({ error: "You have already signed this agreement" });
      return;
    }

    const newSig = {
      orgId: myMembership.organizationId,
      userId: req.user!.sub,
      role: myMembership.role,
      authorityVerified: true,
      signedAt: new Date().toISOString(),
    };

    const newSigs = [...existingSigs, newSig];
    const newStatus = newSigs.length >= 2 ? "SIGNED" : "UNDER_REVIEW";

    const [updated] = await db
      .update(agreementsTable)
      .set({ signatures: newSigs, status: newStatus })
      .where(eq(agreementsTable.id, agreement.id))
      .returning();

    if (newStatus === "SIGNED") {
      await updateWorkspaceStatus(workspaceId, "AWAITING_FUNDING");
    }

    await logActivity(
      workspaceId,
      req.user!.sub,
      myMembership.organizationId,
      "AGREEMENT_SIGNED",
      { agreementId: agreement.id },
    );

    res.json(updated);
  },
);

// GET /workspaces/:workspaceId/contract
router.get(
  "/workspaces/:workspaceId/contract",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract) {
      res.status(404).json({ error: "No contract found" });
      return;
    }

    res.json(contract);
  },
);

// POST /workspaces/:workspaceId/contract
router.post(
  "/workspaces/:workspaceId/contract",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { templateId, chain } = req.body as { templateId?: string; chain?: string };

    if (!templateId) {
      res.status(400).json({ error: "templateId is required" });
      return;
    }

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership) {
      res.status(403).json({ error: "Not a member of this workspace" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const [organization] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, workspaceMembership.organizationId))
      .limit(1);

    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    try {
      requireKybVerified(organization.verificationStatus);
    } catch (error) {
      if (error instanceof PolicyError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    const [agreement] = await db
      .select()
      .from(agreementsTable)
      .where(eq(agreementsTable.workspaceId, workspaceId))
      .limit(1);

    if (!agreement) {
      res.status(400).json({ error: "Agreement must exist before deploying contract" });
      return;
    }

    const [termSheet] = await db
      .select()
      .from(termSheetsTable)
      .where(eq(termSheetsTable.workspaceId, workspaceId))
      .limit(1);

    if (!termSheet) {
      res.status(400).json({ error: 'Term sheet must exist before deploying contract' });
      return;
    }

    const termSheetTerms = (termSheet.terms ?? {}) as any;
    const milestoneDefs = Array.isArray(termSheetTerms.milestones) ? termSheetTerms.milestones : [];
    const milestoneTotal = milestoneDefs.reduce((sum: number, milestone: any) => sum + Number(milestone?.amount ?? 0), 0);
    const totalAmount = String(termSheetTerms.value ?? termSheetTerms.amount ?? termSheetTerms.totalAmount ?? milestoneTotal);

    if (!totalAmount || totalAmount === '0') {
      res.status(400).json({ error: 'Term sheet must define a non-zero deal amount' });
      return;
    }

    const participantOrgIds = (workspace.participantOrgIds as string[]) ?? [];
    const recipientOrgIds = participantOrgIds.filter((participantOrgId) => participantOrgId !== workspaceMembership.organizationId);

    if (recipientOrgIds.length === 0) {
      res.status(400).json({ error: 'Workspace must have at least one counterparty recipient' });
      return;
    }

    const recipientWallets: string[] = [];
    for (const recipientOrgId of recipientOrgIds) {
      const [recipientWallet] = await db
        .select()
        .from(walletsTable)
        .where(
          and(
            eq(walletsTable.organizationId, recipientOrgId),
            eq(walletsTable.purpose, 'TREASURY'),
          ),
        )
        .limit(1);

      if (!recipientWallet?.blockchainAddress) {
        res.status(404).json({ error: 'Recipient wallet not found for organization ' + recipientOrgId });
        return;
      }

      recipientWallets.push(recipientWallet.blockchainAddress);
    }

    const bpsBase = Math.floor(10000 / recipientWallets.length);
    const bpsArray = recipientWallets.map((_, index) => (index === 0 ? 10000 - bpsBase * (recipientWallets.length - 1) : bpsBase));

    let deployment;
    try {
      deployment = await deployDealContract(templateId, agreement.agreementHash);
    } catch (error) {
      console.error('[workspaces] contract template resolution failed', error);
      res.status(502).json({ error: 'Deal contract deployment failed' });
      return;
    }

    if (!deployment?.contractAddress) {
      res.status(503).json({ error: 'Deal contract deployment is not configured or returned no address' });
      return;
    }

    let onchainDealId = '';
    let onchainTxHash = deployment.txHash;

    if ((templateId ?? '').toLowerCase().includes('escrow')) {
      try {
        const created = await createEscrowDeal(deployment.contractAddress, totalAmount, recipientWallets, bpsArray, 0);
        onchainDealId = created.escrowId;
        onchainTxHash = created.txHash;

        if (milestoneDefs.length > 0) {
          const milestoneAmounts = milestoneDefs.map((milestone: any) => String(milestone?.amount ?? '0'));
          const milestoneDescriptions = milestoneDefs.map((milestone: any) => String(milestone?.description ?? 'Milestone'));
          await addEscrowMilestones(deployment.contractAddress, onchainDealId, milestoneAmounts, milestoneDescriptions);
        } else {
          await addEscrowMilestones(deployment.contractAddress, onchainDealId, [totalAmount], [String(termSheetTerms.title ?? 'Milestone')]);
        }
      } catch (error) {
        console.error('[workspaces] on-chain escrow creation failed', error);
        res.status(502).json({ error: 'On-chain escrow creation failed' });
        return;
      }
    }

    const [contract] = await db
      .insert(dealContractsTable)
      .values({
        workspaceId,
        agreementId: agreement.id,
        templateId,
        onchainDealId: onchainDealId || null,
        chain: chain ?? "MATIC-AMOY",
        contractAddress: deployment.contractAddress,
        settlementStatus: "DEPLOYED",
      })
      .returning();

    let onchainSnapshot: object | null = null;
    try {
      if (templateId.toLowerCase().includes("escrow")) {
        onchainSnapshot = await readEscrowSplitSnapshot(deployment.contractAddress);
      } else if (templateId.toLowerCase().includes("agreement")) {
        onchainSnapshot = await readAgreementSnapshot(deployment.contractAddress);
      }
    } catch (error) {
      console.warn("[workspaces] unable to read onchain snapshot after deployment", error);
    }

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    await logActivity(
      workspaceId,
      req.user!.sub,
      myMembership?.organizationId ?? workspaceId,
      "CONTRACT_DEPLOYMENT_INITIATED",
      { contractId: contract.id, templateId, chain, txHash: onchainTxHash, onchainSnapshot, onchainDealId },
    );

    res.status(201).json(contract);
  },
);

// POST /workspaces/:workspaceId/fund
router.post(
  "/workspaces/:workspaceId/fund",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { amount, currency, idempotencyKey } = req.body as {
      amount?: string;
      currency?: string;
      idempotencyKey?: string;
    };

    if (!amount || !currency) {
      res.status(400).json({ error: "amount and currency are required" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "AWAITING_FUNDING") {
      res.status(400).json({
        error: "Workspace must be in AWAITING_FUNDING status to fund escrow",
      });
      return;
    }

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership?.canFund) {
      res.status(403).json({ error: "You do not have permission to fund this workspace" });
      return;
    }

    const [organization] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, workspaceMembership.organizationId))
      .limit(1);

    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    try {
      requireKybVerified(organization.verificationStatus);
    } catch (error) {
      if (error instanceof PolicyError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(
        and(
          eq(walletsTable.organizationId, workspaceMembership.organizationId),
          eq(walletsTable.purpose, "TREASURY"),
        ),
      )
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "Wallet not found for your organization" });
      return;
    }

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract?.contractAddress || !contract.onchainDealId) {
      res.status(400).json({ error: "On-chain escrow must exist before funding" });
      return;
    }

    let onchainFundingTxHash: string | null = null;
    try {
      const funded = await fundEscrowDeal(contract.contractAddress, contract.onchainDealId, amount);
      onchainFundingTxHash = funded.txHash;
    } catch (error) {
      console.error("[workspaces] on-chain escrow funding failed", error);
      res.status(502).json({ error: "On-chain escrow funding failed" });
      return;
    }

    await db
      .update(dealContractsTable)
      .set({ settlementStatus: "FUNDED" })
      .where(eq(dealContractsTable.id, contract.id));

    await logActivity(
      workspaceId,
      req.user!.sub,
      workspaceMembership.organizationId,
      "ESCROW_FUNDED",
      { amount, currency, onchainFundingTxHash },
    );

    await updateWorkspaceStatus(workspaceId, "FUNDED");

    res.status(202).json({
      transferId: 'fund-' + crypto.randomUUID(),
      status: "INITIATED",
      amount,
      currency,
      onchainFundingTxHash,
    });
  },
);


// POST /workspaces/:workspaceId/start
router.post(
  "/workspaces/:workspaceId/start",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "FUNDED") {
      res.status(409).json({ error: "Workspace must be in FUNDED status to start work" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership) {
      res.status(403).json({ error: "You are not a member of this workspace" });
      return;
    }

    await updateWorkspaceStatus(workspaceId, "IN_PROGRESS");

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    await logActivity(workspaceId, req.user!.sub, myMembership?.organizationId ?? membership.organizationId, "WORKSPACE_STARTED", {});

    res.json({ ...workspace, status: "IN_PROGRESS" });
  },
);

// POST /workspaces/:workspaceId/settle
router.post(
  "/workspaces/:workspaceId/settle",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const { milestoneId, settlementStatus } = req.body as {
      milestoneId?: string;
      settlementStatus?: "COMPLETED" | "PARTIALLY_SETTLED";
    };

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "AWAITING_ACCEPTANCE") {
      res.status(409).json({ error: "Workspace must be in AWAITING_ACCEPTANCE status to settle" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership) {
      res.status(403).json({ error: "You are not a member of this workspace" });
      return;
    }

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract?.contractAddress || !contract.onchainDealId) {
      res.status(404).json({ error: "Deal contract not found" });
      return;
    }

    let milestone: { id: string; onchainMilestoneIndex: number | null } | null = null;
    if (milestoneId) {
      [milestone] = await db
        .select({ id: milestonesTable.id, onchainMilestoneIndex: milestonesTable.onchainMilestoneIndex })
        .from(milestonesTable)
        .where(
          and(
            eq(milestonesTable.id, milestoneId),
            eq(milestonesTable.dealContractId, contract.id),
          ),
        )
        .limit(1);

      if (!milestone) {
        res.status(404).json({ error: "Milestone not found" });
        return;
      }

      if (milestone.onchainMilestoneIndex === null || milestone.onchainMilestoneIndex === undefined) {
        res.status(400).json({ error: "Milestone is missing an on-chain index" });
        return;
      }

      try {
        await releaseEscrowMilestone(contract.contractAddress, contract.onchainDealId, milestone.onchainMilestoneIndex);
      } catch (error) {
        console.error("[workspaces] on-chain milestone release failed", error);
        res.status(502).json({ error: "On-chain milestone release failed" });
        return;
      }
    } else {
      try {
        const released = await releaseEscrowMilestone(contract.contractAddress, contract.onchainDealId, 0);
        void released;
      } catch (error) {
        console.error("[workspaces] on-chain settlement failed", error);
        res.status(502).json({ error: "On-chain settlement failed" });
        return;
      }
    }

    const finalSettlementStatus = settlementStatus ?? "COMPLETED";
    await db
      .update(dealContractsTable)
      .set({ settlementStatus: finalSettlementStatus })
      .where(eq(dealContractsTable.id, contract.id));

    await updateWorkspaceStatus(workspaceId, finalSettlementStatus);

    let onchainSnapshot: object | null = null;
    try {
      if ((contract.templateId ?? "").toLowerCase().includes("escrow")) {
        onchainSnapshot = await readEscrowSplitSnapshot(contract.contractAddress ?? "");
      } else if ((contract.templateId ?? "").toLowerCase().includes("agreement")) {
        onchainSnapshot = await readAgreementSnapshot(contract.contractAddress ?? "");
      }
    } catch (error) {
      console.warn("[workspaces] unable to read onchain snapshot during settlement", error);
    }

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    await logActivity(workspaceId, req.user!.sub, myMembership?.organizationId ?? membership.organizationId, "WORKSPACE_SETTLED", {
      contractId: contract.id,
      milestoneId: milestone?.id ?? null,
      settlementStatus: finalSettlementStatus,
      onchainSnapshot,
    });

    res.json({
      workspaceId,
      contractId: contract.id,
      milestoneId: milestone?.id ?? null,
      settlementStatus: finalSettlementStatus,
      onchainSnapshot,
    });
  },
);

// GET /workspaces/:workspaceId/evidence
router.get(
  "/workspaces/:workspaceId/evidence",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const evid = await db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.workspaceId, workspaceId));

    res.json(evid);
  },
);

// POST /workspaces/:workspaceId/evidence
router.post(
  "/workspaces/:workspaceId/evidence",
  authenticate,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { evidenceType, submittedByOrgId, milestoneId } = req.body as {
      evidenceType?: string;
      submittedByOrgId?: string;
      milestoneId?: string;
    };

    if (!req.file || !evidenceType || !submittedByOrgId) {
      res.status(400).json({ error: "file, evidenceType, and submittedByOrgId are required" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "IN_PROGRESS") {
      res.status(409).json({ error: "Evidence can only be submitted in IN_PROGRESS status" });
      return;
    }

    const workspaceMembership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!workspaceMembership || workspaceMembership.organizationId !== submittedByOrgId) {
      res.status(403).json({ error: "You cannot submit evidence for this organization" });
      return;
    }

    const contentHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    // Encrypt + pin
    const { encryptedBuffer, encryptedDek, dekIv } = encryptDocument(req.file.buffer);
    const { ipfsCid } = await pinEncryptedFile(
      encryptedBuffer,
      `evidence-${workspaceId}-${Date.now()}`,
      { workspaceId, evidenceType, submittedByOrgId },
    );

    const [docRef] = await db
      .insert(documentRefsTable)
      .values({
        organizationId: submittedByOrgId,
        docType: "EVIDENCE",
        ipfsCid,
        contentHash,
        encryptionKeyRef: encryptedDek,
        encryptionIv: dekIv,
        uploadedBy: req.user!.sub,
      })
      .returning();

    const [evidence] = await db
      .insert(evidenceTable)
      .values({
        workspaceId,
        milestoneId: milestoneId ?? null,
        submittedByOrgId,
        evidenceType,
        documentRefId: docRef.id,
        contentHash,
      })
      .returning();

    if (milestoneId) {
      await db
        .update(milestonesTable)
        .set({ status: "SUBMITTED" })
        .where(eq(milestonesTable.id, milestoneId));
    }

    await logActivity(workspaceId, req.user!.sub, submittedByOrgId, "EVIDENCE_SUBMITTED", {
      evidenceId: evidence.id,
      evidenceType,
    });

    await updateWorkspaceStatus(workspaceId, "AWAITING_ACCEPTANCE");

    res.status(201).json(evidence);
  },
);

// GET /workspaces/:workspaceId/milestones
router.get(
  "/workspaces/:workspaceId/milestones",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract) {
      res.json([]);
      return;
    }

    const milestones = await db
      .select()
      .from(milestonesTable)
      .where(eq(milestonesTable.dealContractId, contract.id));

    res.json(milestones);
  },
);

// POST /workspaces/:workspaceId/milestones
router.post(
  "/workspaces/:workspaceId/milestones",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const { description, descriptionHash, amount, dueDate } = req.body as {
      description?: string;
      descriptionHash?: string;
      amount?: string;
      dueDate?: string;
    };

    if (!description || !amount) {
      res.status(400).json({ error: "description and amount are required" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership?.canApproveTerms) {
      res.status(403).json({ error: "You do not have permission to create milestones" });
      return;
    }

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract) {
      res.status(400).json({ error: "Deal contract must exist before creating milestones" });
      return;
    }

    const existingMilestones = await db
      .select({ id: milestonesTable.id })
      .from(milestonesTable)
      .where(eq(milestonesTable.dealContractId, contract.id));
    const onchainMilestoneIndex = existingMilestones.length;

    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      res.status(400).json({ error: "dueDate must be a valid date-time" });
      return;
    }

    const [milestone] = await db
      .insert(milestonesTable)
      .values({
        dealContractId: contract.id,
        description,
        descriptionHash: descriptionHash ?? crypto.createHash("sha256").update(description).digest("hex"),
        onchainMilestoneIndex,
        amount,
        dueDate: parsedDueDate,
        status: "PENDING",
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, membership.organizationId, "MILESTONE_CREATED", {
      milestoneId: milestone.id,
    });

    res.status(201).json(milestone);
  },
);

// POST /workspaces/:workspaceId/milestones/:milestoneId/approve
router.post(
  "/workspaces/:workspaceId/milestones/:milestoneId/approve",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const milestoneId = Array.isArray(req.params.milestoneId)
      ? req.params.milestoneId[0]
      : req.params.milestoneId;

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || workspace.status !== "AWAITING_ACCEPTANCE") {
      res.status(409).json({ error: "Milestones can only be approved in AWAITING_ACCEPTANCE status" });
      return;
    }

    const [milestone] = await db
      .update(milestonesTable)
      .set({ status: "APPROVED" })
      .where(eq(milestonesTable.id, milestoneId))
      .returning();

    if (!milestone) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }

    const [contract] = await db
      .select()
      .from(dealContractsTable)
      .where(eq(dealContractsTable.workspaceId, workspaceId))
      .limit(1);

    if (!contract?.contractAddress || !contract.onchainDealId) {
      res.status(400).json({ error: "On-chain escrow must exist before approving milestones" });
      return;
    }

    if (milestone.onchainMilestoneIndex === null || milestone.onchainMilestoneIndex === undefined) {
      res.status(400).json({ error: "Milestone is missing an on-chain index" });
      return;
    }

    try {
      await approveEscrowMilestone(contract.contractAddress, contract.onchainDealId, milestone.onchainMilestoneIndex);
    } catch (error) {
      console.error("[workspaces] on-chain milestone approval failed", error);
      res.status(502).json({ error: "On-chain milestone approval failed" });
      return;
    }

    const [myMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.user!.sub))
      .limit(1);

    await logActivity(
      workspaceId,
      req.user!.sub,
      myMembership?.organizationId ?? workspaceId,
      "MILESTONE_APPROVED",
      { milestoneId },
    );

    res.json(milestone);
  },
);

// GET /workspaces/:workspaceId/dispute
router.get(
  "/workspaces/:workspaceId/dispute",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [dispute] = await db
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.workspaceId, workspaceId))
      .limit(1);

    if (!dispute) {
      res.status(404).json({ error: "No dispute found" });
      return;
    }

    res.json(dispute);
  },
);

// POST /workspaces/:workspaceId/dispute
router.post(
  "/workspaces/:workspaceId/dispute",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const { openedByOrgId, reason } = req.body as {
      openedByOrgId?: string;
      reason?: string;
    };

    if (!openedByOrgId || !reason) {
      res.status(400).json({ error: "openedByOrgId and reason are required" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || !["IN_PROGRESS", "AWAITING_ACCEPTANCE"].includes(workspace.status)) {
      res.status(409).json({ error: "Disputes can only be opened while work is in progress or awaiting acceptance" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership || membership.organizationId !== openedByOrgId) {
      res.status(403).json({ error: "You cannot open a dispute for this organization" });
      return;
    }

    const [existingDispute] = await db
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.workspaceId, workspaceId))
      .limit(1);
    if (existingDispute && existingDispute.status !== "RESOLVED") {
      res.status(409).json({ error: "An active dispute already exists for this workspace" });
      return;
    }

    if (existingDispute?.arbitratorId) {
      const [grant] = await db
        .select()
        .from(disputeDocGrantsTable)
        .where(
          and(
            eq(disputeDocGrantsTable.disputeId, existingDispute.id),
            eq(disputeDocGrantsTable.workspaceId, workspaceId),
            eq(disputeDocGrantsTable.granteeId, existingDispute.arbitratorId),
            gt(disputeDocGrantsTable.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!grant) {
        res.status(409).json({ error: "The assigned arbitrator does not have an active document grant" });
        return;
      }
    }

    const [dispute] = await db
      .insert(disputesTable)
      .values({
        workspaceId,
        openedByOrgId,
        reason,
        status: "OPEN",
      })
      .returning();

    await logActivity(workspaceId, req.user!.sub, openedByOrgId, "DISPUTE_OPENED", {
      disputeId: dispute.id,
      reason,
    });

    await updateWorkspaceStatus(workspaceId, "DISPUTED");

    res.status(201).json(dispute);
  },
);


// POST /workspaces/:workspaceId/dispute/resolve
router.post(
  '/workspaces/:workspaceId/dispute/resolve',
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;
    const { resolution } = req.body as { resolution?: string };

    const [updated] = await db
      .update(disputesTable)
      .set({ status: 'RESOLVED', resolution: resolution ?? null, resolvedAt: new Date() })
      .where(eq(disputesTable.workspaceId, workspaceId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    await updateWorkspaceStatus(workspaceId, 'COMPLETED');
    res.json(updated);
  },
);

// GET /workspaces/:workspaceId/reputation
router.get(
  "/workspaces/:workspaceId/reputation",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const records = await db
      .select()
      .from(reputationRecordsTable)
      .where(eq(reputationRecordsTable.workspaceId, workspaceId));

    res.json(records);
  },
);

// POST /workspaces/:workspaceId/reputation
router.post(
  "/workspaces/:workspaceId/reputation",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const [workspace] = await db
      .select()
      .from(dealWorkspacesTable)
      .where(eq(dealWorkspacesTable.id, workspaceId))
      .limit(1);

    if (!workspace || !["COMPLETED", "PARTIALLY_SETTLED"].includes(workspace.status)) {
      res.status(400).json({
        error: "Reputation can only be submitted after workspace is COMPLETED",
      });
      return;
    }

    const { organizationId, counterpartyOrgId, roleInDeal, dimensions } = req.body as {
      organizationId?: string;
      counterpartyOrgId?: string;
      roleInDeal?: string;
      dimensions?: object;
    };

    if (!organizationId || !counterpartyOrgId || !roleInDeal) {
      res.status(400).json({ error: "organizationId, counterpartyOrgId, and roleInDeal are required" });
      return;
    }

    const membership = await getWorkspaceMembership(workspaceId, req.user!.sub);
    if (!membership || membership.organizationId !== organizationId) {
      res.status(403).json({ error: "You cannot submit reputation for this organization" });
      return;
    }

    if (
      organizationId === counterpartyOrgId ||
      !(workspace.participantOrgIds as string[]).includes(counterpartyOrgId)
    ) {
      res.status(400).json({ error: "counterpartyOrgId must identify another workspace participant" });
      return;
    }

    const [record] = await db
      .insert(reputationRecordsTable)
      .values({
        organizationId,
        workspaceId,
        counterpartyOrgId,
        roleInDeal,
        dimensions: dimensions ?? {},
      })
      .returning();

    res.status(201).json(record);
  },
);

// GET /workspaces/:workspaceId/activity
router.get(
  "/workspaces/:workspaceId/activity",
  authenticate,
  async (req, res): Promise<void> => {
    const workspaceId = Array.isArray(req.params.workspaceId)
      ? req.params.workspaceId[0]
      : req.params.workspaceId;

    const logs = await db
      .select()
      .from(workspaceActivityLogsTable)
      .where(eq(workspaceActivityLogsTable.workspaceId, workspaceId));

    res.json(logs);
  },
);

export default router;
