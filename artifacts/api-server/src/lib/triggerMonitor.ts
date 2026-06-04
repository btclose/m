import { TriggerStore, type Trigger } from "./triggerStore.js";
import { BitunixClient } from "./bitunix.js";
import { positionsCache } from "./cache.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 3000;

function conditionMet(trigger: Trigger, markPrice: number, pnlPct: number): boolean {
  let value: number;

  if (trigger.triggerType === "price_target") {
    value = markPrice;
  } else if (trigger.triggerType === "pnl_percent") {
    value = pnlPct;
  } else if (trigger.triggerType === "trailing_stop") {
    value = markPrice;
  } else {
    return false;
  }

  return trigger.condition === "above" ? value >= trigger.value : value <= trigger.value;
}

async function runCheck(): Promise<void> {
  if (!BitunixClient.isConfigured()) return;

  const store = TriggerStore.getInstance();
  const activeTriggers = store.getActive();
  if (activeTriggers.length === 0) return;

  let positions: Awaited<ReturnType<BitunixClient["getPositions"]>>;
  try {
    const client = BitunixClient.fromSettings();
    positions = await client.getPositions();
    positionsCache.set("positions", positions, 4000);
  } catch (err) {
    logger.warn({ err }, "Trigger monitor: failed to fetch positions");
    return;
  }

  for (const trigger of activeTriggers) {
    const position = positions.find(p => p.id === trigger.positionId);

    if (!position) {
      store.deactivate(trigger.id);
      logger.info({ triggerId: trigger.id, symbol: trigger.symbol }, "Trigger deactivated: position closed");
      continue;
    }

    if (trigger.triggerType === "trailing_stop") {
      const isLong = position.side === "long";
      if (isLong) {
        const high = Math.max(trigger.highWatermark ?? position.markPrice, position.markPrice);
        store.updateWatermark(trigger.id, high, undefined);
        const dropPct = ((high - position.markPrice) / high) * 100;
        if (dropPct >= trigger.value) {
          await executeClose(trigger, "Trailing stop (long) triggered", store);
        }
      } else {
        const low = Math.min(trigger.lowWatermark ?? position.markPrice, position.markPrice);
        store.updateWatermark(trigger.id, undefined, low);
        const risePct = ((position.markPrice - low) / low) * 100;
        if (risePct >= trigger.value) {
          await executeClose(trigger, "Trailing stop (short) triggered", store);
        }
      }
      continue;
    }

    if (conditionMet(trigger, position.markPrice, position.unrealizedPnlPct)) {
      await executeClose(trigger, undefined, store);
    }
  }
}

async function executeClose(trigger: Trigger, reason: string | undefined, store: TriggerStore): Promise<void> {
  try {
    const client = BitunixClient.fromSettings();
    await client.closePosition(trigger.positionId, { closeType: trigger.closeType });
    positionsCache.delete("positions");
    store.markExecuted(trigger.id);
    logger.info(
      { triggerId: trigger.id, symbol: trigger.symbol, type: trigger.triggerType, reason },
      "Trigger Ninja: position closed"
    );
  } catch (err: any) {
    store.markExecuted(trigger.id, err?.message ?? "Unknown error");
    logger.error({ err, triggerId: trigger.id }, "Trigger Ninja: close order failed");
  }
}

let inFlight = false;

export function startTriggerMonitor(): void {
  logger.info("Trigger Ninja monitor started");
  setInterval(() => {
    if (inFlight) return;
    inFlight = true;
    runCheck()
      .catch(err => logger.error({ err }, "Trigger monitor: unhandled error"))
      .finally(() => { inFlight = false; });
  }, POLL_INTERVAL_MS);
}
