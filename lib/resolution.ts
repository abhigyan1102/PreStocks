import { isAddress } from "@solana/kit";
import type { Holding, LifecycleEvent, LifecycleTransition, PreStockAsset, ResolutionPlan } from "./domain";
import { evaluateHolding } from "./guardian";

export function createResolutionPlan(
  asset: PreStockAsset,
  holding: Holding,
  events: LifecycleEvent[],
  transitions: LifecycleTransition[],
  now = new Date(),
): ResolutionPlan {
  if (holding.simulated) throw new Error("A live resolution plan requires a scanned wallet holding");
  const evaluation = evaluateHolding(asset, holding, events, now);
  const event = evaluation.lifecycle.event;
  const linked = transitions.find((item) => item.sourceEventId === event?.id && item.sourceAssetMint === asset.mint && item.sourceAssetSymbol === asset.symbol);
  const base: ResolutionPlan = {
    status: "NO_ACTION_REQUIRED",
    recommendedAction: "NONE",
    sourceMint: asset.mint,
    targetSymbol: linked?.destinationAssetSymbol ?? null,
    targetMint: linked?.destinationAssetMint ?? null,
    inputRawAmount: holding.rawBalance,
    deadline: event?.deadline ?? null,
    executionMode: linked?.executionMode ?? "UNKNOWN",
    officialInstructionsUrl: event?.actionUrl ?? null,
    eventSourceUrl: event?.sourceUrl ?? null,
    sourceEventId: event?.id ?? null,
    factType: "verified_source_and_derived_plan",
  };
  if (evaluation.lifecycle.state === "EXPIRED") return { ...base, status: "EXPIRED" };
  if (evaluation.lifecycle.state !== "ACTION_REQUIRED") return base;
  if (linked?.executionMode === "SWAP" && linked.destinationAssetMint && isAddress(linked.destinationAssetMint) && linked.destinationAssetMint !== asset.mint) {
    return { ...base, status: "ROUTE_CHECK_REQUIRED", recommendedAction: "CHECK_ROUTE" };
  }
  return { ...base, status: "MANUAL_ACTION_REQUIRED", recommendedAction: "REVIEW_OFFICIAL_INSTRUCTIONS" };
}
