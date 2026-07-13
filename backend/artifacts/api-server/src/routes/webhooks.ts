import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dealContractsTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /webhooks/circle
router.post("/webhooks/circle", async (req, res): Promise<void> => {
  const payload = req.body as {
    clientId?: string;
    notificationType?: string;
    version?: number;
    transfer?: { id: string; state: string };
    transaction?: { id: string; state: string };
  };

  logger.info({ notificationType: payload.notificationType }, "Circle webhook received");

  // Handle transfer status updates
  if (payload.notificationType === "transfers" && payload.transfer) {
    const { id: transferId, state } = payload.transfer;
    logger.info({ transferId, state }, "Transfer status update");
    // In production: look up which deal this transfer funds and update its status
    // For MVP we log and return 200
  }

  // Handle transaction confirmations (e.g., milestone releases)
  if (payload.notificationType === "transactions" && payload.transaction) {
    const { id: txId, state } = payload.transaction;
    logger.info({ txId, state }, "Transaction status update");

    if (state === "CONFIRMED") {
      // Update DealContract settlement status
      // In production: resolve txId → contract → update settlementStatus
    }
  }

  res.status(200).json({ acknowledged: true });
});

export default router;
