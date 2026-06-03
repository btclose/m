import crypto from "crypto";
import { SettingsStore } from "./settingsStore.js";

interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  leverage: number;
  margin: number;
  createdAt: string;
}

interface ClosePositionRequest {
  closeType: "market" | "limit" | "stop_market" | "stop_limit" | "trailing_stop";
  price?: number;
  stopPrice?: number;
  trailingOffset?: number;
}

interface ReducePositionRequest {
  reducePercent: number;
  closeType: "market" | "limit";
  price?: number;
}

interface OrderResult {
  orderId: string;
  status: string;
  message?: string;
}

interface Order {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  size: number;
  filled: number;
  status: string;
  createdAt: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  closedAt: string;
}

interface Account {
  totalBalance: number;
  availableBalance: number;
  usedMargin: number;
  unrealizedPnl: number;
  equity: number;
  marginRatio: number;
}

export class BitunixClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  static fromSettings(): BitunixClient {
    const s = SettingsStore.getInstance().get();
    return new BitunixClient(s.apiKey, s.apiSecret, s.baseUrl);
  }

  private sign(timestamp: string, method: string, path: string, body: string = ""): string {
    const message = timestamp + method.toUpperCase() + path + body;
    return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex");
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const timestamp = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : "";
    const signature = this.sign(timestamp, method, path, bodyStr);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
        "timestamp": timestamp,
        "sign": signature,
      },
      body: bodyStr || undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bitunix API error ${res.status}: ${text}`);
    }

    const json = await res.json() as { code: number; msg: string; data: T };
    if (json.code !== 0) {
      throw new Error(`Bitunix error: ${json.msg}`);
    }
    return json.data;
  }

  async getPositions(): Promise<Position[]> {
    const data = await this.request<{ list: any[] }>("GET", "/api/v1/futures/position/get_pending_positions");
    const list = data?.list ?? [];
    return list.map((p: any) => {
      const entryPrice = parseFloat(p.openPrice ?? p.avgOpenPrice ?? 0);
      const markPrice = parseFloat(p.marketPrice ?? p.markPrice ?? entryPrice);
      const size = parseFloat(p.qty ?? p.size ?? 0);
      const margin = parseFloat(p.margin ?? 0);
      const unrealizedPnl = parseFloat(p.unrealizedPNL ?? p.profit ?? 0);
      const unrealizedPnlPct = entryPrice > 0 ? (unrealizedPnl / margin) * 100 : 0;
      return {
        id: String(p.positionId ?? p.id),
        symbol: p.symbol,
        side: (p.side ?? "").toLowerCase() === "buy" || (p.side ?? "").toLowerCase() === "long" ? "long" : "short",
        size,
        entryPrice,
        markPrice,
        liquidationPrice: parseFloat(p.liquidationPrice ?? 0),
        unrealizedPnl,
        unrealizedPnlPct,
        leverage: parseInt(p.leverage ?? 1),
        margin,
        createdAt: p.ctime ? new Date(Number(p.ctime)).toISOString() : new Date().toISOString(),
      } satisfies Position;
    });
  }

  async closePosition(positionId: string, req: ClosePositionRequest): Promise<OrderResult> {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.id === positionId);
    if (!pos) throw new Error("Position not found");

    const orderSide = pos.side === "long" ? "Sell" : "Buy";
    let orderType = "Market";
    let body: Record<string, unknown> = {
      symbol: pos.symbol,
      side: orderSide,
      qty: pos.size,
      reduceOnly: true,
    };

    if (req.closeType === "limit" && req.price) {
      orderType = "Limit";
      body.price = req.price;
    } else if (req.closeType === "stop_market" && req.stopPrice) {
      orderType = "StopMarket";
      body.stopPrice = req.stopPrice;
    } else if (req.closeType === "stop_limit" && req.stopPrice && req.price) {
      orderType = "StopLimit";
      body.stopPrice = req.stopPrice;
      body.price = req.price;
    } else if (req.closeType === "trailing_stop" && req.trailingOffset) {
      orderType = "TrailingStop";
      body.trailingDelta = req.trailingOffset;
    }

    body.orderType = orderType;
    const data = await this.request<{ orderId: string; status: string }>("POST", "/api/v1/futures/trade/place_order", body);
    return {
      orderId: String(data.orderId ?? ""),
      status: data.status ?? "submitted",
    };
  }

  async reducePosition(positionId: string, req: ReducePositionRequest): Promise<OrderResult> {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.id === positionId);
    if (!pos) throw new Error("Position not found");

    const reduceQty = pos.size * (req.reducePercent / 100);
    const orderSide = pos.side === "long" ? "Sell" : "Buy";
    const body: Record<string, unknown> = {
      symbol: pos.symbol,
      side: orderSide,
      qty: reduceQty,
      orderType: req.closeType === "limit" ? "Limit" : "Market",
      reduceOnly: true,
    };
    if (req.closeType === "limit" && req.price) {
      body.price = req.price;
    }
    const data = await this.request<{ orderId: string; status: string }>("POST", "/api/v1/futures/trade/place_order", body);
    return {
      orderId: String(data.orderId ?? ""),
      status: data.status ?? "submitted",
    };
  }

  async closeAllPositions(): Promise<{ closed: number; errors: number }> {
    const positions = await this.getPositions();
    let closed = 0;
    let errors = 0;
    for (const pos of positions) {
      try {
        await this.closePosition(pos.id, { closeType: "market" });
        closed++;
      } catch {
        errors++;
      }
    }
    return { closed, errors };
  }

  async getOpenOrders(): Promise<Order[]> {
    const data = await this.request<{ list: any[] }>("GET", "/api/v1/futures/trade/get_pending_orders");
    const list = data?.list ?? [];
    return list.map((o: any) => ({
      id: String(o.orderId ?? o.id),
      symbol: o.symbol,
      side: o.side,
      type: o.orderType ?? o.type,
      price: parseFloat(o.price ?? 0),
      size: parseFloat(o.qty ?? o.size ?? 0),
      filled: parseFloat(o.filledQty ?? o.cumFilledQty ?? 0),
      status: o.status,
      createdAt: o.ctime ? new Date(Number(o.ctime)).toISOString() : new Date().toISOString(),
    }));
  }

  async cancelOrder(orderId: string): Promise<OrderResult> {
    const data = await this.request<{ orderId: string }>("POST", "/api/v1/futures/trade/cancel_order", { orderId });
    return { orderId: String(data?.orderId ?? orderId), status: "cancelled" };
  }

  async getTradeHistory(limit: number): Promise<Trade[]> {
    const data = await this.request<{ list: any[] }>("GET", `/api/v1/futures/trade/get_history_orders?pageSize=${limit}`);
    const list = data?.list ?? [];
    return list.map((t: any) => ({
      id: String(t.orderId ?? t.id),
      symbol: t.symbol,
      side: (t.side ?? "").toLowerCase(),
      size: parseFloat(t.qty ?? 0),
      entryPrice: parseFloat(t.avgOpenPrice ?? t.price ?? 0),
      exitPrice: parseFloat(t.avgClosePrice ?? t.avgPrice ?? 0),
      realizedPnl: parseFloat(t.realizedPNL ?? t.profit ?? 0),
      closedAt: t.utime ? new Date(Number(t.utime)).toISOString() : new Date().toISOString(),
    }));
  }

  async getAccount(): Promise<Account> {
    const data = await this.request<any>("GET", "/api/v1/futures/account");
    const accountData = data?.list?.[0] ?? data ?? {};
    const totalBalance = parseFloat(accountData.available ?? accountData.totalBalance ?? 0);
    const usedMargin = parseFloat(accountData.frozen ?? accountData.usedMargin ?? 0);
    const unrealizedPnl = parseFloat(accountData.unrealizedPNL ?? accountData.unrealizedPnl ?? 0);
    const equity = totalBalance + unrealizedPnl;
    const marginRatio = equity > 0 ? (usedMargin / equity) * 100 : 0;
    return {
      totalBalance,
      availableBalance: totalBalance,
      usedMargin,
      unrealizedPnl,
      equity,
      marginRatio,
    };
  }
}
