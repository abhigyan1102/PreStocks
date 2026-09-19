import { isAddress } from "@solana/kit";
import type { Holding, LifecycleEvent, LifecycleTransition, PreStockAsset, ResolutionPlan } from "./domain";
import { evaluateHolding } from "./guardian";

export interface ResolutionExecutionAvailability {
  checked: true;
  provider: string;
  verifiedAt: string;
  executable: boolean;
  sourceMint: string;
  destinationMint: string;
  inputRawAmount: string;
}

function verifiedExecution(
  execution: ResolutionExecutionAvailability | undefined,
  sourceMint: string,
  destinationMint: string,
  inputRawAmount: string,
): ResolutionExecutionAvailability | undefined {
  if (!execution) return undefined;
  if (
    !execution.provider.trim() || !Number.isFinite(Date.parse(execution.verifiedAt)) ||
    execution.sourceMint !== sourceMint || execution.destinationMint !== destinationMint ||
    execution.inputRawAmount !== inputRawAmount
  ) throw new Error("Execution availability does not match the resolution plan");
  return execution;
}

export function createResolutionPlan(
  asset: PreStockAsset,
  holding: Holding,
  events: LifecycleEvent[],
  transitions: LifecycleTransition[],
  now = new Date(),
  execution?: ResolutionExecutionAvailability,
): ResolutionPlan {
  if (holding.simulated) throw new Error("A live resolution plan requires a scanned wallet holding");
  const evaluation = evaluateHolding(asset, holding, events, now);
  const event = evaluation.lifecycle.event;
  const linked = transitions.find((item) =>
    item.sourceEventId === event?.id &&
    item.sourceAssetMint === asset.mint &&
    item.sourceAssetSymbol === asset.symbol,
  );
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
    reason: "No current lifecycle action is recorded for this position.",
    historical: false,
    execution: { checked: false, provider: null, verifiedAt: null },
  };

  if (!event) return base;
  if (evaluation.lifecycle.state === "EXPIRED") {
    return { ...base, status: "EXPIRED", recommendedAction: "REVIEW_EVENT", reason: "The sourced event deadline has passed.", historical: true };
  }
  if (evaluation.lifecycle.state === "COMPLETED") {
    return { ...base, status: "INFORMATION_ONLY", recommendedAction: "REVIEW_EVENT", reason: "The sourced event is historical; completion alone does not prove this wallet was resolved.", historical: true };
  }
  if (evaluation.lifecycle.state === "WATCH") {
    return { ...base, status: "INFORMATION_ONLY", recommendedAction: "REVIEW_EVENT", reason: "A sourced lifecycle event is announced, but no current holder action is required." };
  }

  if (linked?.executionMode === "ISSUER_MIGRATION") {
    return { ...base, status: "ISSUER_FLOW_REQUIRED", recommendedAction: "FOLLOW_ISSUER_FLOW", reason: "The sourced transition is issuer-managed and cannot be executed by ActionKit." };
  }
  if (linked?.executionMode === "MANUAL") {
    return { ...base, status: "MANUAL_ACTION_REQUIRED", recommendedAction: "REVIEW_OFFICIAL_INSTRUCTIONS", reason: "The sourced transition requires a manual holder action." };
  }

  const routeCandidate = linked?.executionMode === "SWAP" &&
    Boolean(linked.destinationAssetMint) &&
    isAddress(linked.destinationAssetMint!) &&
    linked.destinationAssetMint !== asset.mint;
  if (routeCandidate) {
    const checked = verifiedExecution(execution, asset.mint, linked!.destinationAssetMint!, holding.rawBalance);
    if (checked?.executable) {
      return {
        ...base,
        status: "EXECUTABLE",
        recommendedAction: "REVIEW_TRANSACTION",
        reason: "A matching live execution route was independently verified. User review and signature are still required.",
        execution: { checked: true, provider: checked.provider, verifiedAt: checked.verifiedAt },
      };
    }
    if (checked && !checked.executable) {
      return {
        ...base,
        status: "NO_EXECUTABLE_ROUTE",
        recommendedAction: "REVIEW_OFFICIAL_INSTRUCTIONS",
        reason: "The verified source and destination have no current executable route.",
        execution: { checked: true, provider: checked.provider, verifiedAt: checked.verifiedAt },
      };
    }
    return { ...base, status: "ROUTE_CHECK_REQUIRED", recommendedAction: "CHECK_ROUTE", reason: "A verified destination exists, but live execution availability has not been checked." };
  }

  if (evaluation.lifecycle.state === "MIGRATING" && !event.actionUrl) {
    return { ...base, status: "ACTION_REQUIRED", recommendedAction: "REVIEW_EVENT", reason: "A transition is in progress, but no supported execution method is recorded." };
  }
  return {
    ...base,
    status: "MANUAL_ACTION_REQUIRED",
    recommendedAction: "REVIEW_OFFICIAL_INSTRUCTIONS",
    reason: "The event is sourced, but no verified destination mint or execution method is recorded.",
  };
}
