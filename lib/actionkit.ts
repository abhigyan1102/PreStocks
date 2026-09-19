import type {
  ActionKitPosition,
  LifecycleTransition,
  PositionAction,
  PositionEvaluation,
} from "./domain";

function officialAssetAction(
  evaluation: PositionEvaluation,
  type: "VIEW_DETAILS" | "VIEW_MARK",
): PositionAction {
  const { asset } = evaluation;
  const details = type === "VIEW_DETAILS";
  const available = details ? Boolean(asset.externalUrl) : asset.markPrice !== null || asset.tokenPrice !== null;
  return {
    id: `${asset.symbol.toLowerCase()}:${details ? "details" : "mark"}`,
    type,
    asset: { symbol: asset.symbol, mint: asset.mint },
    label: details ? `View ${asset.symbol} details` : `View ${asset.symbol} market data`,
    description: details
      ? "Open the official PreStocks asset page."
      : "Read the latest mark and token prices returned by the official PreStocks API.",
    status: available ? "AVAILABLE" : "UNAVAILABLE",
    executable: available,
    executionMode: "INFO",
    source: {
      type: "PRESTOCKS_OFFICIAL_API",
      name: "PreStocks official asset API",
      url: details ? asset.externalUrl || null : "https://prestocks.com/api/prestocks",
      verifiedAt: null,
      reason: details ? "Official asset metadata includes this page." : "The values come from the official asset API.",
    },
    deadline: null,
    metadata: details
      ? {}
      : { markPrice: asset.markPrice, tokenPrice: asset.tokenPrice },
  };
}

function lifecycleActions(
  evaluation: PositionEvaluation,
  transitions: LifecycleTransition[],
): PositionAction[] {
  const event = evaluation.lifecycle.event;
  if (!event) return [];
  const { asset } = evaluation;
  const common = {
    asset: { symbol: asset.symbol, mint: asset.mint },
    deadline: event.deadline,
    source: {
      type: "PRESTOCKS_OFFICIAL_PAGE" as const,
      name: event.sourceName,
      url: event.sourceUrl,
      verifiedAt: event.verifiedAt,
      reason: `Reviewed ${event.type.toLowerCase()} lifecycle notice.`,
    },
  };
  if (evaluation.lifecycle.state === "EXPIRED" || evaluation.lifecycle.state === "COMPLETED") {
    return [{
      ...common,
      id: `${asset.symbol.toLowerCase()}:lifecycle:${event.id}`,
      type: "LIFECYCLE_REVIEW",
      label: `Review ${event.type.toLowerCase()} history`,
      description: "This event is retained for provenance and lineage. It is not a current executable instruction.",
      status: evaluation.lifecycle.state === "EXPIRED" ? "EXPIRED" : "UNAVAILABLE",
      executable: false,
      executionMode: "UNAVAILABLE",
      metadata: { eventId: event.id, eventStatus: event.status, historical: true },
    }];
  }
  if (evaluation.lifecycle.state !== "ACTION_REQUIRED") return [];

  const review: PositionAction = {
    ...common,
    id: `${asset.symbol.toLowerCase()}:lifecycle-review:${event.id}`,
    type: "LIFECYCLE_REVIEW",
    label: event.actionLabel,
    description: "Review the sourced issuer information before taking any position action.",
    status: "REVIEW_REQUIRED",
    executable: true,
    executionMode: "INFO",
    metadata: { eventId: event.id, eventStatus: event.status, actionUrl: event.actionUrl },
  };

  const transition = transitions.find((item) =>
    item.sourceEventId === event.id &&
    item.sourceAssetMint === asset.mint &&
    item.sourceAssetSymbol === asset.symbol,
  );
  const routeCheckable = Boolean(
    transition?.executionMode === "SWAP" &&
    transition.destinationAssetMint &&
    transition.destinationAssetMint !== asset.mint,
  );
  const next: PositionAction = {
    ...common,
    id: `${asset.symbol.toLowerCase()}:resolution:${event.id}`,
    type: routeCheckable ? "SWAP" : event.type === "MIGRATION" || event.type === "IPO" ? "MIGRATE" : "MANUAL_ACTION",
    label: routeCheckable ? "Check live execution route" : "Review migration requirements",
    description: routeCheckable
      ? "A verified destination is recorded, but a fresh execution route must still be checked."
      : "No verified destination mint or executable route is recorded. Follow the official instructions.",
    status: routeCheckable ? "REVIEW_REQUIRED" : "UNAVAILABLE",
    executable: false,
    executionMode: routeCheckable ? "DEX_SWAP" : "UNAVAILABLE",
    source: {
      type: "DERIVED",
      name: "ActionKit resolution logic",
      url: event.sourceUrl,
      verifiedAt: event.verifiedAt,
      reason: routeCheckable
        ? "Derived from a sourced transition with a verified destination; execution still requires a live quote."
        : "Derived from a sourced event with incomplete execution facts.",
    },
    metadata: {
      eventId: event.id,
      destinationSymbol: transition?.destinationAssetSymbol ?? null,
      destinationMint: transition?.destinationAssetMint ?? null,
      requiresLiveQuote: routeCheckable,
    },
  };
  return [review, next];
}

export function getPositionActions(
  evaluation: PositionEvaluation,
  transitions: LifecycleTransition[],
): PositionAction[] {
  return [
    officialAssetAction(evaluation, "VIEW_DETAILS"),
    officialAssetAction(evaluation, "VIEW_MARK"),
    ...lifecycleActions(evaluation, transitions),
  ];
}

export function createActionKitPositions(
  evaluations: PositionEvaluation[],
  transitions: LifecycleTransition[],
): ActionKitPosition[] {
  return evaluations.map((evaluation) => ({
    asset: evaluation.asset,
    holding: evaluation.holding,
    status: evaluation.lifecycle.state,
    actions: getPositionActions(evaluation, transitions),
  }));
}
