import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";
import { accountCache } from "../lib/cache.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cached = accountCache.get("account");
    if (cached) { res.json(cached); return; }
    const client = BitunixClient.fromSettings();
    const account = await client.getAccount();
    accountCache.set("account", account, 4000);
    res.json(account);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch account");
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

export default router;
