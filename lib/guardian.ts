import type { GuardianEvaluation, Holding, LifecycleEvent, PreStockAsset } from "./domain";

export function evaluateHolding(
  asset: PreStockAsset,
  holding: Holding,
  events: LifecycleEvent[],
  now = new Date(),
): GuardianEvaluation {
  if (holding.mint !== asset.mint) throw new Error("Holding mint does not match asset");
  const event = events.find((candidate) =>
    candidate.assetSymbol === asset.symbol && candidate.assetMint === asset.mint,
  ) ?? null;
  if (!event) {
    return { asset, holding, lifecycle: { state: "ACTIVE", event: null }, actions: [], severity: "none" };
  }
  const expired = Boolean(event.deadline && Date.parse(event.deadline) <= now.getTime());
  if (expired || event.status === "EXPIRED") {
    return { asset, holding, lifecycle: { state: "EXPIRED", event }, actions: [], severity: "critical" };
  }
  if (event.status === "COMPLETED") {
    return { asset, holding, lifecycle: { state: "COMPLETED", event }, actions: [], severity: "info" };
  }
  if (event.status === "IN_PROGRESS") {
    return { asset, holding, lifecycle: { state: "MIGRATING", event }, actions: [], severity: "warning" };
  }
  if (event.status === "ACTION_REQUIRED") {
    return {
      asset,
      holding,
      lifecycle: { state: "ACTION_REQUIRED", event },
      actions: [{ type: "REVIEW", label: event.actionLabel, url: event.actionUrl }],
      severity: "critical",
    };
  }
  return { asset, holding, lifecycle: { state: "WATCH", event }, actions: [], severity: "warning" };
}
