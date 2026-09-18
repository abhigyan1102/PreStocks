import assert from "node:assert/strict";
import test from "node:test";
import type { Holding, LifecycleEvent, PreStockAsset } from "./domain";
import { evaluateHolding } from "./guardian";
import { validateLifecycleEvent } from "./lifecycle";
import { premiumPercent } from "./prestocks";

const asset: PreStockAsset = {
  name: "SpaceX PreStocks", symbol: "SPACEX", description: "", image: "", externalUrl: "https://prestocks.com/spacex",
  mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh", markPrice: 100, markValuation: null,
  tokenPrice: 110, impliedValuation: null, supply: null,
};
const holding: Holding = {
  wallet: "DEMO_WALLET", mint: asset.mint, rawBalance: "1240", decimals: 2, uiBalance: "12.40", simulated: true,
};
const event: LifecycleEvent = {
  id: "space-event", assetSymbol: "SPACEX", assetMint: asset.mint, type: "IPO", status: "ACTION_REQUIRED",
  announcedAt: null, effectiveAt: null, deadline: "2027-03-12T23:59:00Z", actionLabel: "Read source",
  actionUrl: "https://prestocks.com/spacex", sourceUrl: "https://prestocks.com/spacex",
  sourceName: "PreStocks", verifiedAt: "2026-09-17T19:15:31Z", notes: "",
};

test("sourced event requires action before its deadline", () => {
  const result = evaluateHolding(asset, holding, [event], new Date("2026-09-18T00:00:00Z"));
  assert.equal(result.lifecycle.state, "ACTION_REQUIRED");
  assert.deepEqual(result.actions, [{ type: "REVIEW", label: "Read source", url: event.actionUrl }]);
});

test("deadline boundary expires an event and removes action link", () => {
  const result = evaluateHolding(asset, holding, [event], new Date(event.deadline!));
  assert.equal(result.lifecycle.state, "EXPIRED");
  assert.equal(result.actions.length, 0);
});

test("an unrelated token mint cannot trigger an action", () => {
  const result = evaluateHolding(asset, holding, [{ ...event, assetMint: "OtherMint" }]);
  assert.equal(result.lifecycle.state, "ACTIVE");
});

test("premium is neutral arithmetic and absent when mark is invalid", () => {
  assert.equal(premiumPercent(asset), 10);
  assert.equal(premiumPercent({ ...asset, markPrice: 0 }), null);
});

test("event provenance cannot point away from the official source", () => {
  assert.throws(() => validateLifecycleEvent({ ...event, sourceUrl: "https://example.com/spacex" }));
  assert.throws(() => validateLifecycleEvent({ ...event, verifiedAt: "unknown" }));
});
