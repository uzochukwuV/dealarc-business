import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  documentRefsTable,
  organizationMembersTable,
  adminDocumentAccessLogsTable,
  verificationCasesTable,
  adminReviewSessionsTable,
  disputeDocGrantsTable,
  evidenceTable,
  agreementsTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { encryptDocument, decryptDocument, verifyContentHash } from "../lib/encryption";
import { pinEncryptedFile, fetchEncryptedFile } from "../lib/pinata";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── POST /organizations/:orgId/documents ──────────────────────────────────────
router.post(
  "/organizations/:orgId/documents",
  authenticate,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const docType = (req.body as { docType?: string }).docType ?? "OTHER";

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

    const { encryptedBuffer, contentHash, encryptedDek, dekIv } = encryptDocument(
      req.file.buffer,
    );

    const filename = `doc-${Date.now()}-${req.file.originalname}`;
    const { ipfsCid } = await pinEncryptedFile(encryptedBuffer, filename, {
      orgId,
      docType,
      uploader: req.user!.sub,
    });

    const [docRef] = await db
      .insert(documentRefsTable)
      .values({
        organizationId: orgId,
        docType,
        ipfsCid,
        contentHash,
        encryptionKeyRef: encryptedDek,
        encryptionIv: dekIv,
        uploadedBy: req.user!.sub,
      })
      .returning();

    res.status(201).json(docRef);
  },
);

// ── GET /organizations/:orgId/documents ───────────────────────────────────────
router.get(
  "/organizations/:orgId/documents",
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

    const docs = await db
      .select()
      .from(documentRefsTable)
      .where(eq(documentRefsTable.organizationId, orgId));

    res.json(docs);
  },
);

// ── GET /documents/:docId/download ────────────────────────────────────────────
// Access is allowed if the requester is:
//   1. A member of the organization that owns the document, OR
//   2. An admin with an active, non-expired review session for any verification
//      case belonging to that organization, OR
//   3. A user holding a valid dispute doc grant whose workspace scope contains
//      this document (i.e. the doc appears in that workspace's evidence or
//      agreement records).
router.get("/documents/:docId/download", authenticate, async (req, res): Promise<void> => {
  const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;

  const [doc] = await db
    .select()
    .from(documentRefsTable)
    .where(eq(documentRefsTable.id, docId))
    .limit(1);

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const now = new Date();
  let accessContext = "document_download";
  let authorized = false;

  // 1. Org membership
  const [membership] = await db
    .select()
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.organizationId, doc.organizationId),
        eq(organizationMembersTable.userId, req.user!.sub),
      ),
    )
    .limit(1);

  if (membership) {
    authorized = true;
    accessContext = "org_member_download";
  }

  // 2. Admin with active review session for this org
  if (!authorized) {
    const [activeCase] = await db
      .select({ caseId: verificationCasesTable.id })
      .from(verificationCasesTable)
      .where(eq(verificationCasesTable.organizationId, doc.organizationId))
      .limit(1);

    if (activeCase) {
      const [session] = await db
        .select()
        .from(adminReviewSessionsTable)
        .where(
          and(
            eq(adminReviewSessionsTable.adminId, req.user!.sub),
            eq(adminReviewSessionsTable.caseId, activeCase.caseId),
            gt(adminReviewSessionsTable.expiresAt, now),
          ),
        )
        .limit(1);

      if (session) {
        authorized = true;
        accessContext = `admin_review session=${session.id}`;
      }
    }
  }

  // 3. Dispute doc grant (arbitrator scoped access)
  if (!authorized) {
    const grants = await db
      .select()
      .from(disputeDocGrantsTable)
      .where(
        and(
          eq(disputeDocGrantsTable.granteeId, req.user!.sub),
          gt(disputeDocGrantsTable.expiresAt, now),
        ),
      );

    for (const grant of grants) {
      // Verify the document belongs to this grant's workspace
      const [evid] = await db
        .select({ id: evidenceTable.id })
        .from(evidenceTable)
        .where(
          and(
            eq(evidenceTable.documentRefId, doc.id),
            eq(evidenceTable.workspaceId, grant.workspaceId),
          ),
        )
        .limit(1);

      const [agr] = !evid
        ? await db
            .select({ id: agreementsTable.id })
            .from(agreementsTable)
            .where(
              and(
                eq(agreementsTable.documentRefId, doc.id),
                eq(agreementsTable.workspaceId, grant.workspaceId),
              ),
            )
            .limit(1)
        : [null];

      if (evid || agr) {
        authorized = true;
        accessContext = `dispute_grant grantId=${grant.id} disputeId=${grant.disputeId}`;
        break;
      }
    }
  }

  if (!authorized) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Log access
  await db.insert(adminDocumentAccessLogsTable).values({
    adminId: req.user!.sub,
    documentId: doc.id,
    reason: "document_download",
    context: accessContext,
  });

  // Fetch from IPFS, decrypt in-memory, stream — never write plaintext to disk
  const encryptedBuffer = await fetchEncryptedFile(doc.ipfsCid);
  const plaintext = decryptDocument(encryptedBuffer, doc.encryptionKeyRef);

  if (!verifyContentHash(plaintext, doc.contentHash)) {
    req.log?.error({ docId }, "Document integrity check failed");
    res.status(500).json({ error: "Document integrity check failed" });
    return;
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="document-${doc.id}-${doc.docType}"`,
  );
  res.send(plaintext);
});

export default router;
