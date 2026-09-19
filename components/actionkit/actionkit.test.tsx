import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { WalletActionsResponse } from "../../sdk";
import { PreStocksActionsView } from "./PreStocksActions";

function render(state: Parameters<typeof PreStocksActionsView>[0]["state"]) {
  return renderToStaticMarkup(<PreStocksActionsView state={state} />);
}

test("React action component renders loading, empty, and error states", () => {
  assert.match(render({ status: "loading" }), /Reading mainnet positions/);
  assert.match(render({ status: "error", message: "RPC unavailable" }), /RPC unavailable/);
  const empty = { mode: "live", product: "PreStocks ActionKit", wallet: "wallet", positions: [], summary: { prestocksPositions: 0, positionsRequiringAction: 0 }, sources: { assets: "PRESTOCKS_OFFICIAL_API", balances: "SOLANA_RPC", lifecycle: "reviewed", actions: "DERIVED" } } satisfies WalletActionsResponse;
  assert.match(render({ status: "ready", data: empty }), /No PreStocks positions/);
});

test("React action component renders an action-required position with provenance", () => {
  const data = {
    mode: "live",
    product: "PreStocks ActionKit",
    wallet: "wallet",
    positions: [{
      symbol: "SPACEX", name: "SpaceX", mint: "mint", balance: "2.5", rawBalance: "2500000", decimals: 6,
      status: "ACTION_REQUIRED",
      market: { tokenPrice: 120, markPrice: 100, source: "PRESTOCKS_OFFICIAL_API" },
      actions: [{
        id: "review", type: "LIFECYCLE_REVIEW", asset: { symbol: "SPACEX", mint: "mint" }, label: "Review IPO notice",
        description: "Review the sourced event.", status: "REVIEW_REQUIRED", executable: true, executionMode: "INFO",
        source: { type: "PRESTOCKS_OFFICIAL_PAGE", name: "PreStocks SpaceX page", url: "https://prestocks.com/spacex", verifiedAt: "2026-09-17T00:00:00Z", reason: "Reviewed source." },
        deadline: "2027-03-12T23:59:00Z", metadata: {},
      }],
    }],
    summary: { prestocksPositions: 1, positionsRequiringAction: 1 },
    sources: { assets: "PRESTOCKS_OFFICIAL_API", balances: "SOLANA_RPC", lifecycle: "reviewed", actions: "DERIVED" },
  } satisfies WalletActionsResponse;
  const html = render({ status: "ready", data });
  assert.match(html, /ACTION REQUIRED/);
  assert.match(html, /Official market data/);
  assert.match(html, /Token \$120\.00 · Mark \$100\.00/);
  assert.match(html, /Review IPO notice/);
  assert.match(html, /PreStocks SpaceX page/);
});
