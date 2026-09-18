export interface PreStockAsset {
  name: string;
  symbol: string;
  description: string;
  image: string;
  externalUrl: string;
  mint: string;
  markPrice: number | null;
  markValuation: number | null;
  tokenPrice: number | null;
  impliedValuation: number | null;
  supply: number | null;
}

export type LifecycleEventType =
  | "ACQUISITION"
  | "MERGER"
  | "IPO"
  | "MIGRATION"
  | "EXPIRATION";

export type LifecycleEventStatus =
  | "ANNOUNCED"
  | "ACTION_REQUIRED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED";

export interface LifecycleEvent {
  id: string;
  assetSymbol: string;
  assetMint: string;
  type: LifecycleEventType;
  status: LifecycleEventStatus;
  announcedAt: string | null;
  effectiveAt: string | null;
  deadline: string | null;
  actionLabel: string;
  actionUrl: string;
  sourceUrl: string;
  sourceName: string;
  verifiedAt: string;
  notes: string;
}

export interface Holding {
  wallet: string;
  mint: string;
  rawBalance: string;
  decimals: number;
  uiBalance: string;
  simulated: boolean;
}

export type GuardianState =
  | "ACTIVE"
  | "WATCH"
  | "ACTION_REQUIRED"
  | "MIGRATING"
  | "COMPLETED"
  | "EXPIRED";

export interface GuardianEvaluation {
  asset: PreStockAsset;
  holding: Holding;
  lifecycle: {
    state: GuardianState;
    event: LifecycleEvent | null;
  };
  actions: Array<{ type: "REVIEW"; label: string; url: string }>;
  severity: "none" | "info" | "warning" | "critical";
}
