export interface Trigger {
  id: string;
  positionId: string;
  symbol: string;
  triggerType: "price_target" | "pnl_percent" | "trailing_stop" | "time_based";
  condition: "above" | "below";
  value: number;
  closeType: "market" | "limit";
  active: boolean;
  createdAt: string;
  executedAt?: string;
  executionError?: string;
  highWatermark?: number;
  lowWatermark?: number;
}

export type CreateTriggerRequest = Omit<Trigger, "id" | "active" | "createdAt" | "executedAt" | "executionError" | "highWatermark" | "lowWatermark">;

export class TriggerStore {
  private static instance: TriggerStore;
  private triggers: Map<string, Trigger> = new Map();

  static getInstance(): TriggerStore {
    if (!TriggerStore.instance) {
      TriggerStore.instance = new TriggerStore();
    }
    return TriggerStore.instance;
  }

  getAll(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  getActive(): Trigger[] {
    return Array.from(this.triggers.values()).filter(t => t.active);
  }

  create(data: CreateTriggerRequest): Trigger {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const trigger: Trigger = {
      ...data,
      id,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.triggers.set(id, trigger);
    return trigger;
  }

  delete(id: string): boolean {
    return this.triggers.delete(id);
  }

  update(id: string, partial: Partial<Trigger>): Trigger | null {
    const existing = this.triggers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...partial };
    this.triggers.set(id, updated);
    return updated;
  }

  deactivate(id: string): void {
    const t = this.triggers.get(id);
    if (t) this.triggers.set(id, { ...t, active: false });
  }

  markExecuted(id: string, error?: string): void {
    const t = this.triggers.get(id);
    if (t) {
      this.triggers.set(id, {
        ...t,
        active: false,
        executedAt: new Date().toISOString(),
        executionError: error,
      });
    }
  }

  updateWatermark(id: string, highWatermark?: number, lowWatermark?: number): void {
    const t = this.triggers.get(id);
    if (t) {
      this.triggers.set(id, {
        ...t,
        ...(highWatermark !== undefined ? { highWatermark } : {}),
        ...(lowWatermark !== undefined ? { lowWatermark } : {}),
      });
    }
  }
}
