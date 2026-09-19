import assert from "node:assert/strict";
import test from "node:test";
import type { Holding, LifecycleEvent, LifecycleTransition, PreStockAsset } from "./domain";
import { getPositionActions } from "./actionkit";
import { evaluateHolding } from "./guardian";
import { transitionFromEvent } from "./lineage";

const mint = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const destination = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const asset: PreStockAsset = {
  name: "SpaceX PreStocks",
  symbol: "SPACEX",
  description: "",
  image: "https://prestocks.com/logos/spacex.png",
  externalUrl: "https://prestocks.com/spacex",
  mint,
  markPrice: 100,
  markValuation: 1_000,
  tokenPrice: 110,
  impliedValuation: 1_100,
  supply: 10,
};
const holding: Holding = {
  wallet: "11111111111111111111111111111111",
  mint,
  rawBalance: "12400000",
  decimals: 6,
  uiBalance: "12.400000",
  simulated: false,
};
const event: LifecycleEvent = {
  id: "space-event",
  assetSymbol: "SPACEX",
  assetMint: mint,
  type: "IPO",
  status: "ACTION_REQUIRED",
  announcedAt: null,
  effectiveAt: null,
  deadline: "2027-03-12T23:59:00Z",
  actionLabel: "Review instructions",
  actionUrl: "https://prestocks.com/spacex",
  sourceUrl: "https://prestocks.com/spacex",
  sourceName: "PreStocks SpaceX page",
  sourceType: "PRESTOCKS_OFFICIAL_PAGE",
  verifiedAt: "2026-09-17T00:00:00Z",
  destinationAssetSymbol: null,
  destinationAssetMint: null,
  conversionRatio: null,
  executionMode: "UNKNOWN",
  notes: "",
};
const now = new Date("2026-09-19T00:00:00Z");

test("active position exposes only sourced informational actions", () => {
  const actions = getPositionActions(evaluateHolding(asset, holding, [], now), []);
  assert.deepEqual(actions.map((action) => action.type), ["VIEW_DETAILS", "VIEW_MARK"]);
  assert.ok(actions.every((action) => action.executable));
  assert.ok(actions.every((action) => action.source.type === "PRESTOCKS_OFFICIAL_API"));
});

test("lifecycle event adds review and a non-executable migration action", () => {
  const actions = getPositionActions(
    evaluateHolding(asset, holding, [event], now),
    [transitionFromEvent(event)],
  );
  const migration = actions.find((action) => action.type === "MIGRATE");
  assert.equal(migration?.executable, false);
  assert.equal(migration?.executionMode, "UNAVAILABLE");
  assert.equal(migration?.metadata.destinationMint, null);
  assert.ok(actions.some((action) => action.type === "LIFECYCLE_REVIEW" && action.executable));
});

test("verified destination permits route checking without claiming execution", () => {
  const transition: LifecycleTransition = {
    ...transitionFromEvent(event),
    destinationAssetSymbol: "DEST",
    destinationAssetMint: destination,
    executionMode: "SWAP",
  };
  const action = getPositionActions(evaluateHolding(asset, holding, [event], now), [transition])
    .find((candidate) => candidate.type === "SWAP");
  assert.equal(action?.status, "REVIEW_REQUIRED");
  assert.equal(action?.executionMode, "DEX_SWAP");
  assert.equal(action?.executable, false);
  assert.equal(action?.metadata.requiresLiveQuote, true);
});
