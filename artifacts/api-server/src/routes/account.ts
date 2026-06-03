import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const account = await client.getAccount();
    res.json(account);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch account");
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

export default router;
