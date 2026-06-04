import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";
import { positionsCache } from "../lib/cache.js";

const router = Router();

export async function getPositions() {
  if (!BitunixClient.isConfigured()) return [];
  const cached = positionsCache.get("positions");
  if (cached) return cached;
  const client = BitunixClient.fromSettings();
  const positions = await client.getPositions();
  positionsCache.set("positions", positions, 4000);
  return positions;
}

router.get("/", async (req, res) => {
  try {
    const positions = await getPositions();
    res.json(positions);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch positions");
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

router.post("/:positionId/close", async (req, res) => {
  try {
    if (!BitunixClient.isConfigured()) {
      res.status(400).json({ error: "API key not configured" });
      return;
    }
    const client = BitunixClient.fromSettings();
    const result = await client.closePosition(req.params.positionId, req.body);
    positionsCache.delete("positions");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to close position");
    res.status(500).json({ error: "Failed to close position" });
  }
});

router.post("/:positionId/reduce", async (req, res) => {
  try {
    if (!BitunixClient.isConfigured()) {
      res.status(400).json({ error: "API key not configured" });
      return;
    }
    const client = BitunixClient.fromSettings();
    const result = await client.reducePosition(req.params.positionId, req.body);
    positionsCache.delete("positions");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to reduce position");
    res.status(500).json({ error: "Failed to reduce position" });
  }
});

router.post("/close-all", async (req, res) => {
  try {
    if (!BitunixClient.isConfigured()) {
      res.status(400).json({ error: "API key not configured" });
      return;
    }
    const client = BitunixClient.fromSettings();
    const result = await client.closeAllPositions();
    positionsCache.delete("positions");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to close all positions");
    res.status(500).json({ error: "Failed to close all positions" });
  }
});

export default router;
