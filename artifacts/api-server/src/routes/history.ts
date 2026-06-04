import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (!BitunixClient.isConfigured()) { res.json([]); return; }
    const client = BitunixClient.fromSettings();
    const limit = Number(req.query.limit) || 50;
    const history = await client.getTradeHistory(limit);
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
