import { Router } from "express";
import { TriggerStore } from "../lib/triggerStore.js";
import { BitunixClient } from "../lib/bitunix.js";

const router = Router();
const store = TriggerStore.getInstance();

router.get("/", async (req, res) => {
  res.json(store.getAll());
});

router.post("/", async (req, res) => {
  try {
    const trigger = store.create(req.body);
    res.json(trigger);
  } catch (err) {
    req.log.error({ err }, "Failed to create trigger");
    res.status(400).json({ error: "Invalid trigger data" });
  }
});

router.delete("/:triggerId", async (req, res) => {
  const deleted = store.delete(req.params.triggerId);
  if (!deleted) {
    res.status(404).json({ error: "Trigger not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
