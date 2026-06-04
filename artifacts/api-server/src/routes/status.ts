import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";
import { TriggerStore } from "../lib/triggerStore.js";

const router = Router();

router.get("/", (_req, res) => {
  const configured = BitunixClient.isConfigured();
  const activeTriggers = TriggerStore.getInstance().getActive().length;
  const allTriggers = TriggerStore.getInstance().getAll();
  const executedTriggers = allTriggers.filter(t => t.executedAt).length;

  res.json({
    configured,
    activeTriggers,
    executedTriggers,
    version: "1.0.0",
  });
});

export default router;
