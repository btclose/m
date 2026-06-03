import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const positions = await client.getPositions();
    res.json(positions);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch positions");
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

router.post("/:positionId/close", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const result = await client.closePosition(req.params.positionId, req.body);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to close position");
    res.status(500).json({ error: "Failed to close position" });
  }
});

router.post("/:positionId/reduce", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const result = await client.reducePosition(req.params.positionId, req.body);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to reduce position");
    res.status(500).json({ error: "Failed to reduce position" });
  }
});

router.post("/close-all", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const result = await client.closeAllPositions();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to close all positions");
    res.status(500).json({ error: "Failed to close all positions" });
  }
});

export default router;
