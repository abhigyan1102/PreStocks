"use client";

import type { WalletHoldingsResponse } from "../../sdk";
import { StateMessage, useActionKitRequest } from "./shared";

export function PreStocksPortfolio({ wallet, baseUrl }: { wallet: string; baseUrl?: string }) {
  const state = useActionKitRequest((kit) => kit.wallet.getHoldings(wallet), [wallet], { baseUrl });
  const empty = state.status === "ready" && state.data.positions.length === 0;
  return (
    <section className="ak-root" aria-label="PreStocks portfolio">
      <StateMessage state={state} empty={empty}>
        {state.status === "ready" ? <ul className="ak-position-list">{state.data.positions.map((position) => <li className="ak-position-header" key={position.mint}><strong>{position.symbol}</strong><span className="ak-balance">{position.uiBalance}</span></li>)}</ul> : null}
      </StateMessage>
    </section>
  );
}
