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

/** Factual transition fields must come from a reviewed lifecycle source. */
export interface LifecycleTransition {
  id: string;
  sourceEventId: string;
  sourceAssetSymbol: string;
  sourceAssetMint: string;
  eventType: LifecycleEventType;
  status: LifecycleEventStatus;
  destinationAssetSymbol: string | null;
  destinationAssetMint: string | null;
  conversionRatio: string | null;
  deadline: string | null;
  effectiveAt: string | null;
  instructionsUrl: string;
  sourceUrl: string;
  sourceName: string;
  verifiedAt: string;
  executionMode: "SWAP" | "ISSUER_MIGRATION" | "MANUAL" | "UNKNOWN";
}

export interface PositionLineage {
  origin: string;
  transitions: Array<LifecycleTransition & { historical: boolean }>;
  provenance: "reviewed lifecycle source";
}

export type ResolutionStatus =
  | "NO_ACTION_REQUIRED"
  | "MANUAL_ACTION_REQUIRED"
  | "ROUTE_CHECK_REQUIRED"
  | "EXECUTABLE"
  | "NO_EXECUTABLE_ROUTE"
  | "EXPIRED"
  | "RESOLVED";

export interface ResolutionPlan {
  status: ResolutionStatus;
  recommendedAction: "NONE" | "REVIEW_OFFICIAL_INSTRUCTIONS" | "CHECK_ROUTE";
  sourceMint: string;
  targetSymbol: string | null;
  targetMint: string | null;
  inputRawAmount: string;
  deadline: string | null;
  executionMode: LifecycleTransition["executionMode"];
  officialInstructionsUrl: string | null;
  eventSourceUrl: string | null;
  sourceEventId: string | null;
  factType: "verified_source_and_derived_plan";
}
