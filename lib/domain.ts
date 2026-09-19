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
  sourceType: SourceClass;
  verifiedAt: string;
  destinationAssetSymbol: string | null;
  destinationAssetMint: string | null;
  conversionRatio: string | null;
  executionMode: "SWAP" | "ISSUER_MIGRATION" | "MANUAL" | "UNKNOWN";
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

export type PositionState =
  | "ACTIVE"
  | "WATCH"
  | "ACTION_REQUIRED"
  | "MIGRATING"
  | "COMPLETED"
  | "EXPIRED";

export interface PositionEvaluation {
  asset: PreStockAsset;
  holding: Holding;
  lifecycle: {
    state: PositionState;
    event: LifecycleEvent | null;
  };
  actions: Array<{ type: "REVIEW"; label: string; url: string }>;
  severity: "none" | "info" | "warning" | "critical";
}

/** @deprecated Use PositionState. Retained while older integrations migrate. */
export type GuardianState = PositionState;
/** @deprecated Use PositionEvaluation. Retained while older integrations migrate. */
export type GuardianEvaluation = PositionEvaluation;

export type PositionActionType =
  | "VIEW"
  | "TRADE"
  | "VIEW_MARK"
  | "VIEW_DETAILS"
  | "LIFECYCLE_REVIEW"
  | "MIGRATE"
  | "SWAP"
  | "CLAIM"
  | "REDEEM"
  | "EXIT"
  | "OPEN_ISSUER_FLOW"
  | "MANUAL_ACTION"
  | "NO_ACTION";

export type ActionExecutionMode = "INFO" | "DEX_SWAP" | "ISSUER_FLOW" | "MANUAL" | "UNAVAILABLE";
export type ActionStatus = "AVAILABLE" | "REVIEW_REQUIRED" | "UNAVAILABLE" | "EXPIRED";
export type SourceClass =
  | "PRESTOCKS_OFFICIAL_API"
  | "PRESTOCKS_OFFICIAL_PAGE"
  | "SOLANA_RPC"
  | "JUPITER_LIVE_QUOTE"
  | "DERIVED"
  | "HISTORICAL_REPLAY"
  | "UNKNOWN";

export interface PositionAction {
  id: string;
  type: PositionActionType;
  asset: { symbol: string; mint: string };
  label: string;
  description: string;
  status: ActionStatus;
  executable: boolean;
  executionMode: ActionExecutionMode;
  source: {
    type: SourceClass;
    name: string;
    url: string | null;
    verifiedAt: string | null;
    reason: string;
  };
  deadline: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ActionKitPosition {
  asset: PreStockAsset;
  holding: Holding;
  status: PositionState;
  actions: PositionAction[];
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
  sourceType: SourceClass;
  verifiedAt: string;
  executionMode: "SWAP" | "ISSUER_MIGRATION" | "MANUAL" | "UNKNOWN";
}

export interface PositionLineage {
  origin: string;
  transitions: Array<LifecycleTransition & { historical: boolean }>;
  provenance: "reviewed lifecycle source";
  mode: "informational";
  currentActionDeterminedSeparately: true;
}

export type ResolutionStatus =
  | "NO_ACTION_REQUIRED"
  | "INFORMATION_ONLY"
  | "ACTION_REQUIRED"
  | "MANUAL_ACTION_REQUIRED"
  | "ROUTE_CHECK_REQUIRED"
  | "EXECUTABLE"
  | "ISSUER_FLOW_REQUIRED"
  | "NO_EXECUTABLE_ROUTE"
  | "EXPIRED"
  | "RESOLVED";

export interface ResolutionPlan {
  status: ResolutionStatus;
  recommendedAction: "NONE" | "REVIEW_EVENT" | "REVIEW_OFFICIAL_INSTRUCTIONS" | "FOLLOW_ISSUER_FLOW" | "CHECK_ROUTE" | "REVIEW_TRANSACTION";
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
  reason: string;
  historical: boolean;
  execution: {
    checked: boolean;
    provider: string | null;
    verifiedAt: string | null;
  };
}
