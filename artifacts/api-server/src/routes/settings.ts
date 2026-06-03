import { Router } from "express";
import { SettingsStore } from "../lib/settingsStore.js";

const router = Router();
const store = SettingsStore.getInstance();

router.get("/", async (req, res) => {
  res.json(store.get());
});

router.put("/", async (req, res) => {
  try {
    const updated = store.update(req.body);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(400).json({ error: "Invalid settings" });
  }
});

export default router;
