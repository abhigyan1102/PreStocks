"use client";

import type { WalletActionsResponse } from "../../sdk";
import { PreStocksPosition } from "./PreStocksPosition";
import { StateMessage, type RemoteState, useActionKitRequest } from "./shared";

export function PreStocksActionsView({ state }: { state: RemoteState<WalletActionsResponse> }) {
  const empty = state.status === "ready" && state.data.positions.length === 0;
  return (
    <section className="ak-root" aria-label="PreStocks actions">
      <StateMessage state={state} empty={empty}>
        {state.status === "ready" ? <div className="ak-position-list">{state.data.positions.map((position) => <PreStocksPosition key={position.mint} position={position} />)}</div> : null}
      </StateMessage>
    </section>
  );
}

export function PreStocksActions({ wallet, baseUrl }: { wallet: string; baseUrl?: string }) {
  const state = useActionKitRequest((kit) => kit.wallet.getActions(wallet), [wallet], { baseUrl });
  return <PreStocksActionsView state={state} />;
}
