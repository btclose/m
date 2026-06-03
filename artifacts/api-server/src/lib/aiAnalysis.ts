import { openai } from "./openaiClient.js";
import { aiCache } from "./cache.js";

export interface PositionAnalysis {
  riskScore: number;
  riskLabel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  suggestions: string[];
  macrodroidTips: string[];
  portfolioRisk: string;
  generatedAt: string;
}

export interface MacrodroidMacro {
  name: string;
  description: string;
  trigger: string;
  action: string;
  webhookUrl: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
}

function buildPositionContext(positions: any[], account: any): string {
  if (!positions.length) return "No open positions.";

  const totalPnl = positions.reduce((s: number, p: any) => s + (p.unrealizedPnl ?? 0), 0);
  const worstPos = positions.reduce((a: any, b: any) =>
    (a.unrealizedPnl ?? 0) < (b.unrealizedPnl ?? 0) ? a : b
  );

  return `
ACCOUNT:
- Equity: $${(account?.equity ?? 0).toFixed(2)}
- Available Balance: $${(account?.availableBalance ?? 0).toFixed(2)}
- Used Margin: $${(account?.usedMargin ?? 0).toFixed(2)}
- Margin Ratio: ${(account?.marginRatio ?? 0).toFixed(1)}%
- Total Unrealized PnL: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}

POSITIONS (${positions.length} open):
${positions
  .map(
    (p: any) => `
  - ${p.symbol} ${p.side.toUpperCase()} ${p.leverage}x
    Size: ${p.size}, Entry: $${p.entryPrice?.toFixed(2)}, Mark: $${p.markPrice?.toFixed(2)}
    Liquidation: $${p.liquidationPrice?.toFixed(2)}
    PnL: ${(p.unrealizedPnl ?? 0) >= 0 ? "+" : ""}$${(p.unrealizedPnl ?? 0).toFixed(2)} (${(p.unrealizedPnlPct ?? 0).toFixed(2)}%)
    Margin: $${p.margin?.toFixed(2)}
    Distance to liquidation: ${
      p.markPrice && p.liquidationPrice
        ? (Math.abs((p.markPrice - p.liquidationPrice) / p.markPrice) * 100).toFixed(1)
        : "?"
    }%`
  )
  .join("")}

WORST POSITION: ${worstPos.symbol} at $${(worstPos.unrealizedPnl ?? 0).toFixed(2)} PnL
`.trim();
}

export async function analyzePositions(positions: any[], account: any): Promise<PositionAnalysis> {
  const cacheKey = `analysis:${JSON.stringify(positions.map((p: any) => ({ id: p.id, pnl: Math.round(p.unrealizedPnl) })))}`;
  const cached = aiCache.get(cacheKey) as PositionAnalysis | undefined;
  if (cached) return cached;

  const context = buildPositionContext(positions, account);

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 1200,
    messages: [
      {
        role: "system",
        content: `You are an expert crypto futures trading risk analyst. Analyze the trader's current positions and provide concise, actionable risk intelligence. Be direct and specific — no fluff. Use professional trading terminology. The trader uses a Samsung S10 with MacroDroid for automation.`,
      },
      {
        role: "user",
        content: `Analyze this Bitunix futures portfolio and respond ONLY with valid JSON matching this exact schema:
{
  "riskScore": <0-100 integer, 0=no risk, 100=imminent liquidation>,
  "riskLabel": <"LOW"|"MEDIUM"|"HIGH"|"CRITICAL">,
  "summary": <2-3 sentence portfolio risk summary>,
  "suggestions": [<3-5 specific actionable trade management suggestions>],
  "macrodroidTips": [<4-6 specific MacroDroid automation ideas tailored to current positions — e.g. "Set alarm if BTC drops below $X to trigger close", "Notify if margin ratio exceeds Y%">],
  "portfolioRisk": <one sentence on biggest risk to the whole portfolio right now>
}

${context}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as PositionAnalysis;
  const result: PositionAnalysis = { ...parsed, generatedAt: new Date().toISOString() };

  aiCache.set(cacheKey, result, 90_000); // 90s cache — respectful of API
  return result;
}

export async function generateMacrodroidMacros(
  positions: any[],
  account: any,
  serverUrl: string
): Promise<MacrodroidMacro[]> {
  const cacheKey = `macros:${serverUrl}:${positions.length}`;
  const cached = aiCache.get(cacheKey) as MacrodroidMacro[] | undefined;
  if (cached) return cached;

  const context = buildPositionContext(positions, account);
  const base = serverUrl || "https://YOUR-COOLIFY-SERVER.com";

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 3000,
    messages: [
      {
        role: "system",
        content: `You are an expert in MacroDroid automation for Android and crypto futures trading on Bitunix. Generate sophisticated, highly practical MacroDroid macros that a trader running on a Samsung S10 would actually use daily. Each macro must have a clear trigger, a meaningful action, and use real webhook URLs to the trader's self-hosted server on Coolify/Hetzner. Think beyond the obvious — include macros for things the trader would never think of themselves but would immediately love.`,
      },
      {
        role: "user",
        content: `Generate 15 MacroDroid macros for this Bitunix futures trader. Respond ONLY with a JSON array of macro objects.

Each object must match exactly:
{
  "name": <short macro name>,
  "description": <what this does and why it's valuable>,
  "trigger": <specific MacroDroid trigger description — be precise about settings>,
  "action": <specific MacroDroid action chain description>,
  "webhookUrl": <full URL using base "${base}" — use real API endpoints like /api/positions/close-all, /api/triggers, /api/settings>,
  "category": <"safety"|"profit-taking"|"risk-management"|"notifications"|"automation"|"intelligence">,
  "priority": <"critical"|"high"|"medium"|"low">
}

Trader context:
${context}

Generate exactly 15 macros. Include these MUST-HAVE categories but also think of creative ones:
1. Shake phone to emergency close all (critical safety)
2. Liquidation proximity alarm (< 5% from liq price)
3. Margin ratio danger alert (> 75%)
4. Auto-briefing at market open (8am summary)
5. Sleep mode risk guardian (reduce if big loss while sleeping)
6. PnL milestone celebration + screenshot
7. Volatility spike detector (check every 5 min, alert if unusual)
8. Battery saver trading mode (when phone < 20%, alert about open positions)
9. Location-based risk (if leaving home, check positions)
10. Network loss emergency alert
11. Daily PnL report at market close
12. Winning streak reward (positive PnL 3 days in a row)
13. Overtrading guard (alert if > X positions open)
14. News/event timer warning (set countdown for known events)
15. One creative macro the trader would never think of

Make webhook URLs and trigger settings as specific and copy-paste-ready as possible.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const macros = JSON.parse(cleaned) as MacrodroidMacro[];

  aiCache.set(cacheKey, macros, 300_000); // 5 min cache
  return macros;
}
