import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const orders = await client.getOpenOrders();
    res.json(orders);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch orders");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.delete("/:orderId", async (req, res) => {
  try {
    const client = BitunixClient.fromSettings();
    const result = await client.cancelOrder(req.params.orderId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
