import type { LifecycleEvent, LifecycleTransition, PositionLineage } from "./domain";

/** Preserve only facts carried by the verified event. Unknown transformation facts remain null. */
export function transitionFromEvent(event: LifecycleEvent): LifecycleTransition {
  return {
    id: `transition:${event.id}`,
    sourceEventId: event.id,
    sourceAssetSymbol: event.assetSymbol,
    sourceAssetMint: event.assetMint,
    eventType: event.type,
    status: event.status,
    destinationAssetSymbol: event.destinationAssetSymbol,
    destinationAssetMint: event.destinationAssetMint,
    conversionRatio: event.conversionRatio,
    deadline: event.deadline,
    effectiveAt: event.effectiveAt,
    instructionsUrl: event.actionUrl,
    sourceUrl: event.sourceUrl,
    sourceName: event.sourceName,
    sourceType: event.sourceType,
    verifiedAt: event.verifiedAt,
    executionMode: event.executionMode,
  };
}

function historical(transition: LifecycleTransition, now: Date): boolean {
  return transition.status === "COMPLETED" || transition.status === "EXPIRED" ||
    Boolean(transition.deadline && Date.parse(transition.deadline) <= now.getTime());
}

/** Walk reviewed source-to-destination links; retain history but never infer a missing link. */
export function getPositionLineage(
  origin: string,
  transitions: LifecycleTransition[],
  now = new Date(),
): PositionLineage {
  const result: PositionLineage["transitions"] = [];
  const visited = new Set<string>();
  let symbol: string | null = origin.toUpperCase();
  while (symbol && !visited.has(symbol)) {
    visited.add(symbol);
    const fromCurrent = transitions.filter((item) => item.sourceAssetSymbol === symbol)
      .sort((a, b) => {
        const aDate = Date.parse(a.effectiveAt ?? a.deadline ?? a.verifiedAt);
        const bDate = Date.parse(b.effectiveAt ?? b.deadline ?? b.verifiedAt);
        return aDate - bDate || a.id.localeCompare(b.id);
      });
    result.push(...fromCurrent.map((item) => ({ ...item, historical: historical(item, now) })));
    symbol = fromCurrent.at(-1)?.destinationAssetSymbol ?? null;
  }
  return {
    origin: origin.toUpperCase(),
    transitions: result,
    provenance: "reviewed lifecycle source",
    mode: "informational",
    currentActionDeterminedSeparately: true,
  };
}
