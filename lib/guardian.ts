import type { Holding, LifecycleEvent, PositionEvaluation, PreStockAsset } from "./domain";

export function lifecycleStateForEvent(event: LifecycleEvent, now: Date): PositionEvaluation["lifecycle"]["state"] {
  if (event.status === "COMPLETED") return "COMPLETED";
  if (event.status === "EXPIRED" || (event.deadline && Date.parse(event.deadline) <= now.getTime())) return "EXPIRED";
  if (event.status === "ACTION_REQUIRED") return "ACTION_REQUIRED";
  if (event.status === "IN_PROGRESS") return "MIGRATING";
  return "WATCH";
}

const CURRENT_PRIORITY = { ACTION_REQUIRED: 3, MIGRATING: 2, WATCH: 1, EXPIRED: 0, COMPLETED: 0, ACTIVE: 0 } as const;

function relevantTime(event: LifecycleEvent): number {
  return Date.parse(event.deadline ?? event.effectiveAt ?? event.announcedAt ?? event.verifiedAt);
}

export function compareLifecycleEvents(a: LifecycleEvent, b: LifecycleEvent, now: Date): number {
  const aState = lifecycleStateForEvent(a, now);
  const bState = lifecycleStateForEvent(b, now);
  const priorityDelta = CURRENT_PRIORITY[bState] - CURRENT_PRIORITY[aState];
  if (priorityDelta) return priorityDelta;
  const timeDelta = CURRENT_PRIORITY[aState] === 0
    ? relevantTime(b) - relevantTime(a)
    : relevantTime(a) - relevantTime(b);
  if (timeDelta) return timeDelta;
  const statusDelta = a.status.localeCompare(b.status);
  return statusDelta || a.id.localeCompare(b.id);
}

/** Active notices win over history. Within a state, the nearest action date wins. */
export function resolveLifecycleEvent(
  asset: PreStockAsset,
  events: LifecycleEvent[],
  now = new Date(),
): LifecycleEvent | null {
  const matching = events.filter((event) => event.assetSymbol === asset.symbol && event.assetMint === asset.mint);
  matching.sort((a, b) => compareLifecycleEvents(a, b, now));
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
  const state = lifecycleStateForEvent(event, now);
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
