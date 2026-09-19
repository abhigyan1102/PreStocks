import assert from "node:assert/strict";
import test from "node:test";
import type { LifecycleEvent } from "./domain";
import { StaticVerifiedLifecycleProvider, validateLifecycleEvent } from "./lifecycle";

const event: LifecycleEvent = {
  id: "reviewed-event",
  assetSymbol: "SPACEX",
  assetMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
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

test("static lifecycle provider declares provenance and returns defensive copies", async () => {
  const provider = new StaticVerifiedLifecycleProvider([validateLifecycleEvent(event)]);
  assert.equal(provider.info.mode, "reviewed-static");
  assert.equal(provider.info.sourceType, "PRESTOCKS_OFFICIAL_PAGE");
  assert.match(provider.info.description, /not a corporate-actions API/i);
  const first = await provider.getEvents();
  first[0].sourceName = "mutated";
  const second = await provider.getEvents();
  assert.equal(second[0].sourceName, event.sourceName);
  assert.equal(second[0].destinationAssetMint, null);
});

test("provider filters active events without converting history into current action", async () => {
  const completed = { ...event, id: "completed", status: "COMPLETED" as const, deadline: "2025-01-01T00:00:00Z" };
  const provider = new StaticVerifiedLifecycleProvider([event, completed].map(validateLifecycleEvent));
  const active = await provider.getActiveEvents(new Date("2026-09-19T00:00:00Z"));
  assert.deepEqual(active.map((item) => item.id), [event.id]);
  assert.equal((await provider.getEvents()).length, 2);
});

test("lifecycle validation rejects fabricated or structurally invalid execution facts", () => {
  assert.throws(() => validateLifecycleEvent({ ...event, executionMode: "SWAP" }), /destination mint/);
  assert.throws(() => validateLifecycleEvent({ ...event, conversionRatio: "approximately one" }), /conversion ratio/);
  assert.throws(() => validateLifecycleEvent({ ...event, effectiveAt: "sometime later" }), /invalid date/);
  assert.throws(() => validateLifecycleEvent({ ...event, sourceType: "UNKNOWN" }), /official PreStocks page/);
});
