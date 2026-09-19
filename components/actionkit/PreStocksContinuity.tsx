"use client";

import { StateMessage, useActionKitRequest } from "./shared";

export function PreStocksContinuity({ symbol, baseUrl }: { symbol: string; baseUrl?: string }) {
  const state = useActionKitRequest((kit) => kit.lifecycle.getLineage(symbol), [symbol], { baseUrl });
  const empty = state.status === "ready" && state.data.lineage.transitions.length === 0;
  return (
    <section className="ak-root" aria-label={`${symbol} lifecycle lineage`}>
      <StateMessage state={state} empty={empty}>
        {state.status === "ready" ? <ol className="ak-lineage-list">{state.data.lineage.transitions.map((transition) => <li className="ak-lineage-row" key={transition.id}><span>{transition.sourceAssetSymbol} · {transition.eventType}</span><span className="ak-meta">{transition.status.replaceAll("_", " ")}</span></li>)}</ol> : null}
      </StateMessage>
    </section>
  );
}
