import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import documentsRouter from "./documents";
import verificationRouter from "./verification";
import adminRouter from "./admin";
import walletsRouter from "./wallets";
import connectionsRouter from "./connections";
import workspacesRouter from "./workspaces";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(documentsRouter);
router.use(verificationRouter);
router.use(adminRouter);
router.use(walletsRouter);
router.use(connectionsRouter);
router.use(workspacesRouter);
router.use(webhooksRouter);

export default router;
