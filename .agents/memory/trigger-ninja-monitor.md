---
name: Trigger Ninja monitor
description: Background 3-second polling loop that auto-executes Trigger Ninja close orders when price/PnL conditions are met.
---

# Trigger Ninja monitor

File: `artifacts/api-server/src/lib/triggerMonitor.ts`
Started: in `artifacts/api-server/src/app.ts` via `startTriggerMonitor()`

## Logic
- Polls every 3000ms
- Skips if `BitunixClient.isConfigured()` is false
- Skips if no active triggers
- Fetches live positions, caches them (4s TTL)
- For each active trigger, finds matching position by positionId
- If position gone → deactivates trigger
- Condition types: price_target (compare markPrice), pnl_percent (compare unrealizedPnlPct), trailing_stop (track high/lowWatermark then compare % drop/rise)
- On condition met → calls `client.closePosition()`, busts positions cache, calls `store.markExecuted()`
- On error → calls `store.markExecuted(triggerId, errorMessage)`

## TriggerStore additions
- `executedAt?: string` — ISO timestamp when fired
- `executionError?: string` — error message if close order failed
- `highWatermark?: number`, `lowWatermark?: number` — for trailing stop tracking
- `getActive()`, `deactivate()`, `markExecuted()`, `updateWatermark()` methods

**Why:** Triggers were stored but never acted on. The monitor makes them real.

**How to apply:** If adding new trigger types, add condition logic to `conditionMet()` in triggerMonitor.ts. Trailing stop uses watermark state tracked in TriggerStore.
