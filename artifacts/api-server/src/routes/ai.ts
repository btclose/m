import { Router } from "express";
import { BitunixClient } from "../lib/bitunix.js";
import { SettingsStore } from "../lib/settingsStore.js";
import { analyzePositions, generateMacrodroidMacros } from "../lib/aiAnalysis.js";
import { positionsCache, accountCache } from "../lib/cache.js";

const router = Router();

async function getCachedPositions() {
  const cached = positionsCache.get("positions");
  if (cached) return cached;
  const client = BitunixClient.fromSettings();
  const positions = await client.getPositions();
  positionsCache.set("positions", positions, 4000); // 4s cache — tight but safe
  return positions;
}

async function getCachedAccount() {
  const cached = accountCache.get("account");
  if (cached) return cached;
  const client = BitunixClient.fromSettings();
  const account = await client.getAccount();
  accountCache.set("account", account, 4000);
  return account;
}

// GET /api/ai/analysis — AI risk analysis of current positions
router.get("/analysis", async (req, res) => {
  try {
    const [positions, account] = await Promise.all([
      getCachedPositions(),
      getCachedAccount(),
    ]);
    const analysis = await analyzePositions(positions, account);
    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "Analysis failed. Check API key and positions." });
  }
});

// GET /api/ai/macros — Generate MacroDroid macros tailored to current state
router.get("/macros", async (req, res) => {
  try {
    const settings = SettingsStore.getInstance().get();
    const [positions, account] = await Promise.all([
      getCachedPositions(),
      getCachedAccount(),
    ]);
    const macros = await generateMacrodroidMacros(
      positions,
      account,
      settings.coolifyEndpoint || `https://${req.hostname}`
    );
    res.json(macros);
  } catch (err) {
    req.log.error({ err }, "MacroDroid macro generation failed");
    res.status(500).json({ error: "Macro generation failed." });
  }
});

// GET /api/ai/macros/export — Download as MacroDroid-importable JSON file
router.get("/macros/export", async (req, res) => {
  try {
    const settings = SettingsStore.getInstance().get();
    const [positions, account] = await Promise.all([
      getCachedPositions(),
      getCachedAccount(),
    ]);
    const macros = await generateMacrodroidMacros(
      positions,
      account,
      settings.coolifyEndpoint || `https://${req.hostname}`
    );

    // MacroDroid-compatible export structure
    const exportData = {
      version: 1,
      appVersion: "5.39.14",
      exportedAt: new Date().toISOString(),
      description: "Bitunix Trader — AI-generated MacroDroid macros",
      macros: macros.map((m, i) => ({
        id: `bitunix_macro_${i + 1}`,
        name: m.name,
        description: m.description,
        category: m.category,
        priority: m.priority,
        enabled: true,
        trigger: {
          type: "manual",
          description: m.trigger,
        },
        actions: [
          {
            type: "webhook",
            url: m.webhookUrl,
            method: "POST",
            description: m.action,
          },
        ],
        setupInstructions: [
          `Trigger: ${m.trigger}`,
          `Action: ${m.action}`,
          `Webhook: ${m.webhookUrl}`,
        ],
      })),
      quickReference: macros.map((m) => ({
        name: m.name,
        priority: m.priority,
        trigger: m.trigger,
        webhook: m.webhookUrl,
      })),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bitunix-macrodroid-${Date.now()}.json"`
    );
    res.json(exportData);
  } catch (err) {
    req.log.error({ err }, "Macro export failed");
    res.status(500).json({ error: "Export failed." });
  }
});

export default router;
