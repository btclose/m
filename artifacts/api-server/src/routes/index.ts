import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import positionsRouter from "./positions.js";
import ordersRouter from "./orders.js";
import historyRouter from "./history.js";
import accountRouter from "./account.js";
import triggersRouter from "./triggers.js";
import settingsRouter from "./settings.js";
import aiRouter from "./ai.js";
import statusRouter from "./status.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/status", statusRouter);
router.use("/positions", positionsRouter);
router.use("/orders", ordersRouter);
router.use("/history", historyRouter);
router.use("/account", accountRouter);
router.use("/triggers", triggersRouter);
router.use("/settings", settingsRouter);
router.use("/ai", aiRouter);

export default router;
