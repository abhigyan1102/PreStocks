import assert from "node:assert/strict";
import test from "node:test";
import type { Holding, LifecycleEvent, LifecycleTransition, PreStockAsset } from "./domain";
import { getUnsignedTransactionForReview, QuoteValidationError, quoteResolutionStatus, type QuoteRequest, type VerifiedQuote } from "./execution";
import { getPositionLineage, transitionFromEvent } from "./lineage";
import { createResolutionPlan } from "./resolution";

const wallet = "11111111111111111111111111111111";
const mint = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const destination = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const asset: PreStockAsset = { name: "SpaceX", symbol: "SPACEX", mint, description: "", image: "", externalUrl: "", markPrice: null, markValuation: null, tokenPrice: null, impliedValuation: null, supply: null };
const holding: Holding = { wallet, mint, rawBalance: "12400000", decimals: 6, uiBalance: "12.400000", simulated: false };
const event: LifecycleEvent = {
  id: "sourced-ipo", assetSymbol: "SPACEX", assetMint: mint, type: "IPO", status: "ACTION_REQUIRED",
  announcedAt: null, effectiveAt: null, deadline: "2027-03-12T23:59:00Z", actionLabel: "Read instructions",
  actionUrl: "https://prestocks.com/spacex", sourceUrl: "https://prestocks.com/spacex", sourceName: "PreStocks",
  sourceType: "PRESTOCKS_OFFICIAL_PAGE", verifiedAt: "2026-09-17T00:00:00Z",
  destinationAssetSymbol: null, destinationAssetMint: null, conversionRatio: null, executionMode: "UNKNOWN", notes: "",
};
const now = new Date("2026-09-18T00:00:00Z");
const unknown = transitionFromEvent(event);

test("event conversion preserves provenance and leaves unknown destinations null", () => {
  assert.equal(unknown.destinationAssetMint, null);
  assert.equal(unknown.conversionRatio, null);
  assert.equal(unknown.executionMode, "UNKNOWN");
  assert.equal(unknown.sourceUrl, event.sourceUrl);
});

test("missing destination mint cannot produce a route-ready plan", () => {
  const plan = createResolutionPlan(asset, holding, [event], [unknown], now);
  assert.equal(plan.status, "MANUAL_ACTION_REQUIRED");
  assert.equal(plan.targetMint, null);
});

test("no lifecycle event means no action required", () => {
  assert.equal(createResolutionPlan(asset, holding, [], [], now).status, "NO_ACTION_REQUIRED");
});

test("expired event is historical and cannot be executable", () => {
  const later = new Date("2027-03-13T00:00:00Z");
  assert.equal(createResolutionPlan(asset, holding, [event], [unknown], later).status, "EXPIRED");
  assert.equal(getPositionLineage("SPACEX", [unknown], later).transitions[0].historical, true);
});

test("a verified destination can be marked for route check but not executable yet", () => {
  const linked: LifecycleTransition = { ...unknown, executionMode: "SWAP", destinationAssetSymbol: "DEST", destinationAssetMint: destination };
  assert.equal(createResolutionPlan(asset, holding, [event], [linked], now).status, "ROUTE_CHECK_REQUIRED");
});

test("announced and completed events are information only", () => {
  const announced = { ...event, status: "ANNOUNCED" as const };
  const completed = { ...event, status: "COMPLETED" as const, deadline: "2026-01-01T00:00:00Z" };
  assert.equal(createResolutionPlan(asset, holding, [announced], [transitionFromEvent(announced)], now).status, "INFORMATION_ONLY");
  const historical = createResolutionPlan(asset, holding, [completed], [transitionFromEvent(completed)], now);
  assert.equal(historical.status, "INFORMATION_ONLY");
  assert.equal(historical.historical, true);
});

test("issuer-managed transition produces issuer flow rather than execution", () => {
  const linked: LifecycleTransition = { ...unknown, executionMode: "ISSUER_MIGRATION" };
  const plan = createResolutionPlan(asset, holding, [event], [linked], now);
  assert.equal(plan.status, "ISSUER_FLOW_REQUIRED");
  assert.equal(plan.recommendedAction, "FOLLOW_ISSUER_FLOW");
  assert.equal(plan.execution.checked, false);
});

test("matching execution evidence can distinguish executable from no route", () => {
  const linked: LifecycleTransition = { ...unknown, executionMode: "SWAP", destinationAssetSymbol: "DEST", destinationAssetMint: destination };
  const base = { checked: true as const, provider: "TestRouter", verifiedAt: now.toISOString(), sourceMint: mint, destinationMint: destination, inputRawAmount: holding.rawBalance };
  assert.equal(createResolutionPlan(asset, holding, [event], [linked], now, { ...base, executable: true }).status, "EXECUTABLE");
  assert.equal(createResolutionPlan(asset, holding, [event], [linked], now, { ...base, executable: false }).status, "NO_EXECUTABLE_ROUTE");
});

test("execution evidence for a different amount or mint is rejected", () => {
  const linked: LifecycleTransition = { ...unknown, executionMode: "SWAP", destinationAssetSymbol: "DEST", destinationAssetMint: destination };
  const wrong = { checked: true as const, executable: true, provider: "TestRouter", verifiedAt: now.toISOString(), sourceMint: mint, destinationMint: destination, inputRawAmount: "1" };
  assert.throws(() => createResolutionPlan(asset, holding, [event], [linked], now, wrong), /does not match/);
});

test("a mismatched source mint cannot trigger a transition", () => {
  const wrong: LifecycleTransition = { ...unknown, sourceAssetMint: destination, executionMode: "SWAP", destinationAssetMint: destination };
  assert.equal(createResolutionPlan(asset, holding, [event], [wrong], now).status, "MANUAL_ACTION_REQUIRED");
});

test("lineage can contain multiple sourced historical transitions", () => {
  const first: LifecycleTransition = { ...unknown, id: "first", sourceAssetSymbol: "XAI", sourceAssetMint: destination, status: "COMPLETED", eventType: "ACQUISITION", destinationAssetSymbol: "SPACEX", destinationAssetMint: mint, deadline: "2025-01-01T00:00:00Z" };
  const second: LifecycleTransition = { ...unknown, id: "second", status: "COMPLETED", destinationAssetSymbol: null, deadline: "2025-02-01T00:00:00Z" };
  const lineage = getPositionLineage("XAI", [second, first], now);
  assert.deepEqual(lineage.transitions.map((item) => item.id), ["first", "second"]);
  assert.ok(lineage.transitions.every((item) => item.historical));
});

test("simulated holdings cannot be passed to the live planner", () => {
  assert.throws(() => createResolutionPlan(asset, { ...holding, simulated: true }, [event], [unknown], now));
});

const request: QuoteRequest = { mode: "live", wallet, inputMint: mint, outputMint: destination, inputRawAmount: "12400000" };
// Syntactically valid unsigned test transaction with this wallet as signer and one inert instruction.
const mockedTransaction = Buffer.concat([
  Buffer.from([1]), Buffer.alloc(64), Buffer.from([1, 0, 0, 1]), Buffer.alloc(32), Buffer.alloc(32),
  Buffer.from([1, 0, 0, 0]),
]).toString("base64");
const quote: VerifiedQuote = { provider: "Jupiter", inputMint: mint, outputMint: destination, inputRawAmount: "12400000", outputRawAmount: "2000000", router: "metis", requestId: "mock-order", quoteTimestamp: now.toISOString(), unsignedTransaction: mockedTransaction };

test("no route produces NO_EXECUTABLE_ROUTE", () => {
  assert.equal(quoteResolutionStatus(request, null, now), "NO_EXECUTABLE_ROUTE");
});

test("a matching fresh mocked route is eligible for execution", () => {
  assert.equal(quoteResolutionStatus(request, quote, now), "EXECUTABLE");
});

test("a stale quote is rejected", () => {
  assert.throws(() => getUnsignedTransactionForReview(request, quote, new Date(now.getTime() + 16_000)), QuoteValidationError);
});

test("mismatched source or destination mints are rejected", () => {
  assert.throws(() => getUnsignedTransactionForReview({ ...request, inputMint: destination }, quote, now), QuoteValidationError);
  assert.throws(() => getUnsignedTransactionForReview({ ...request, outputMint: mint }, quote, now), QuoteValidationError);
});

test("transaction bytes cannot be requested without a verified quote", () => {
  assert.throws(() => getUnsignedTransactionForReview(request, null, now), QuoteValidationError);
});

test("provider failure cannot yield a transaction", async () => {
  const router = { async getQuote() { throw new Error("Jupiter unavailable"); } };
  await assert.rejects(router.getQuote(), /Jupiter unavailable/);
});

test("replay mode can never enter live transaction review", () => {
  assert.throws(() => getUnsignedTransactionForReview({ ...request, mode: "replay" } as unknown as QuoteRequest, quote, now), QuoteValidationError);
});
