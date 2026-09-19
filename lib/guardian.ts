import type { Holding, LifecycleEvent, PositionEvaluation, PreStockAsset } from "./domain";

function stateFor(event: LifecycleEvent, now: Date): PositionEvaluation["lifecycle"]["state"] {
  if (event.status === "EXPIRED" || (event.deadline && Date.parse(event.deadline) <= now.getTime())) return "EXPIRED";
  if (event.status === "COMPLETED") return "COMPLETED";
  if (event.status === "ACTION_REQUIRED") return "ACTION_REQUIRED";
  if (event.status === "IN_PROGRESS") return "MIGRATING";
  return "WATCH";
}

const PRIORITY = { ACTION_REQUIRED: 5, MIGRATING: 4, WATCH: 3, EXPIRED: 2, COMPLETED: 1, ACTIVE: 0 } as const;

/** Active notices win over history. Within a state, the nearest action date wins. */
export function resolveLifecycleEvent(
  asset: PreStockAsset,
  events: LifecycleEvent[],
  now = new Date(),
): LifecycleEvent | null {
  const matching = events.filter((event) => event.assetSymbol === asset.symbol && event.assetMint === asset.mint);
  matching.sort((a, b) => {
    const aState = stateFor(a, now);
    const bState = stateFor(b, now);
    if (aState !== bState) return PRIORITY[bState] - PRIORITY[aState];
    const date = (event: LifecycleEvent) => Date.parse(event.deadline ?? event.effectiveAt ?? event.announcedAt ?? event.verifiedAt);
    const aDate = date(a);
    const bDate = date(b);
    // For current events choose the nearest deadline/effective date; for history choose the latest.
    if (aDate !== bDate) return aState === "EXPIRED" || aState === "COMPLETED" ? bDate - aDate : aDate - bDate;
    return a.id.localeCompare(b.id);
  });
  return matching[0] ?? null;
}

export function evaluateHolding(
  asset: PreStockAsset,
  holding: Holding,
  events: LifecycleEvent[],
  now = new Date(),
): PositionEvaluation {
  if (holding.mint !== asset.mint) throw new Error("Holding mint does not match asset");
  const event = resolveLifecycleEvent(asset, events, now);
  if (!event) {
    return { asset, holding, lifecycle: { state: "ACTIVE", event: null }, actions: [], severity: "none" };
  }
  const state = stateFor(event, now);
  if (state === "EXPIRED") {
    return { asset, holding, lifecycle: { state: "EXPIRED", event }, actions: [], severity: "critical" };
  }
  if (state === "COMPLETED") {
    return { asset, holding, lifecycle: { state: "COMPLETED", event }, actions: [], severity: "info" };
  }
  if (state === "MIGRATING") {
    return { asset, holding, lifecycle: { state: "MIGRATING", event }, actions: [], severity: "warning" };
  }
  if (state === "ACTION_REQUIRED") {
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
