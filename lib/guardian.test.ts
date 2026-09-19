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
  sourceName: "PreStocks", sourceType: "PRESTOCKS_OFFICIAL_PAGE", verifiedAt: "2026-09-17T19:15:31Z",
  destinationAssetSymbol: null, destinationAssetMint: null, conversionRatio: null, executionMode: "UNKNOWN", notes: "",
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

test("active action beats an older completed event", () => {
  const historical: LifecycleEvent = { ...event, id: "old", status: "COMPLETED", deadline: "2025-01-01T00:00:00Z" };
  const result = evaluateHolding(asset, holding, [historical, event], new Date("2026-09-18T00:00:00Z"));
  assert.equal(result.lifecycle.event?.id, event.id);
  assert.equal(result.lifecycle.state, "ACTION_REQUIRED");
});

test("event ordering does not change evaluation", () => {
  const watch: LifecycleEvent = { ...event, id: "watch", status: "ANNOUNCED", deadline: "2027-02-01T00:00:00Z" };
  const now = new Date("2026-09-18T00:00:00Z");
  const first = evaluateHolding(asset, holding, [watch, event], now);
  const second = evaluateHolding(asset, holding, [event, watch], now);
  assert.deepEqual(first, second);
  assert.equal(first.lifecycle.event?.id, event.id);
});

test("nearest action deadline wins among equal-priority events", () => {
  const sooner: LifecycleEvent = { ...event, id: "sooner", deadline: "2026-12-01T00:00:00Z" };
  const result = evaluateHolding(asset, holding, [event, sooner], new Date("2026-09-18T00:00:00Z"));
  assert.equal(result.lifecycle.event?.id, "sooner");
});

test("unrelated symbol cannot trigger an action", () => {
  const result = evaluateHolding(asset, holding, [{ ...event, assetSymbol: "OPENAI" }]);
  assert.equal(result.lifecycle.state, "ACTIVE");
});

test("all input permutations select the same current lifecycle event", () => {
  const events: LifecycleEvent[] = [
    { ...event, id: "completed-newer", status: "COMPLETED", deadline: "2026-06-01T00:00:00Z" },
    { ...event, id: "expired", status: "EXPIRED", deadline: "2026-05-01T00:00:00Z" },
    { ...event, id: "announced", status: "ANNOUNCED", deadline: "2027-01-01T00:00:00Z" },
    { ...event, id: "required", status: "ACTION_REQUIRED", deadline: "2027-03-12T23:59:00Z" },
  ];
  const permutations = <T,>(items: T[]): T[][] => items.length <= 1
    ? [items]
    : items.flatMap((item, index) => permutations(items.filter((_, candidate) => candidate !== index)).map((rest) => [item, ...rest]));
  const results = permutations(events).map((items) => evaluateHolding(asset, holding, items, new Date("2026-09-19T00:00:00Z")));
  assert.ok(results.every((result) => result.lifecycle.event?.id === "required"));
  assert.ok(results.every((result) => result.lifecycle.state === "ACTION_REQUIRED"));
});

test("latest historical event wins when no current event exists", () => {
  const olderExpired: LifecycleEvent = { ...event, id: "older-expired", status: "EXPIRED", deadline: "2025-01-01T00:00:00Z" };
  const newerCompleted: LifecycleEvent = { ...event, id: "newer-completed", status: "COMPLETED", deadline: "2026-01-01T00:00:00Z" };
  const result = evaluateHolding(asset, holding, [olderExpired, newerCompleted], new Date("2026-09-19T00:00:00Z"));
  assert.equal(result.lifecycle.event?.id, "newer-completed");
  assert.equal(result.lifecycle.state, "COMPLETED");
});
