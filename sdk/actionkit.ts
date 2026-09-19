import type {
  PositionAction,
  PositionLineage,
  PositionState,
  PreStockAsset,
  ResolutionPlan,
} from "../lib/domain";

export interface AssetRecord extends PreStockAsset {
  premiumPercent: number | null;
}

export interface AssetListResponse {
  source: string;
  assets: AssetRecord[];
}

export interface WalletPosition {
  symbol: string;
  mint: string;
  rawBalance: string;
  decimals: number;
  uiBalance: string;
}

export interface WalletHoldingsResponse {
  mode: "live";
  wallet: string;
  positions: WalletPosition[];
  summary: { prestocksPositions: number };
  sources: { assetRegistry: "PRESTOCKS_OFFICIAL_API"; balances: "SOLANA_RPC" };
}

export interface ActionPosition extends Omit<WalletPosition, "uiBalance"> {
  name: string;
  balance: string;
  status: PositionState;
  market: {
    tokenPrice: number | null;
    markPrice: number | null;
    source: "PRESTOCKS_OFFICIAL_API";
  };
  actions: PositionAction[];
}

export interface WalletActionsResponse {
  mode: "live";
  product: "PreStocks ActionKit";
  wallet: string;
  positions: ActionPosition[];
  summary: { prestocksPositions: number; positionsRequiringAction: number };
  sources: {
    assets: "PRESTOCKS_OFFICIAL_API";
    balances: "SOLANA_RPC";
    lifecycle: string;
    actions: "DERIVED";
  };
}

export interface LineageResponse {
  provider: {
    id: string;
    mode: "reviewed-static" | "official-api" | "webhook" | "onchain";
    sourceType: string;
    description: string;
  };
  lineage: PositionLineage;
}

export interface ResolutionResponse {
  mode: "live";
  position: WalletPosition & { simulated: false };
  resolution: ResolutionPlan;
}

export interface ActionKitOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class ActionKitRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "ActionKitRequestError";
  }
}

function normalizedBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export class PreStocksActionKit {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  readonly assets = {
    list: (): Promise<AssetListResponse> => this.request("/api/v1/assets"),
    get: async (symbol: string): Promise<AssetRecord | null> => {
      const response = await this.assets.list();
      return response.assets.find((asset) => asset.symbol === symbol.toUpperCase()) ?? null;
    },
  };

  readonly wallet = {
    getHoldings: (wallet: string): Promise<WalletHoldingsResponse> =>
      this.request(`/api/v1/wallet/${encodeURIComponent(wallet)}/prestocks`),
    getActions: (wallet: string): Promise<WalletActionsResponse> =>
      this.request(`/api/v1/wallet/${encodeURIComponent(wallet)}/actions`),
  };

  readonly lifecycle = {
    getLineage: (symbol: string): Promise<LineageResponse> =>
      this.request(`/api/v1/lineage/${encodeURIComponent(symbol)}`),
  };

  readonly resolve = {
    plan: (input: { wallet: string; symbol: string }): Promise<ResolutionResponse> =>
      this.request("/api/v1/resolve/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  };

  constructor(options: ActionKitOptions = {}) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl ?? "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error("PreStocksActionKit requires a fetch implementation");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ActionKitRequestError("ActionKit returned a non-JSON response", response.status, null);
    }
    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `ActionKit request failed with status ${response.status}`;
      throw new ActionKitRequestError(message, response.status, payload);
    }
    return payload as T;
  }
}

