import assert from "node:assert/strict";
import test from "node:test";
import { parsePreStocksAssets } from "./prestocks";

const mint = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const secondMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function apiAsset(overrides: Record<string, unknown> = {}) {
  return {
    name: "SpaceX PreStocks",
    symbol: "SPACEX",
    description: "description",
    image: "https://prestocks.com/logos/spacex.png",
    external_url: "https://prestocks.com/spacex",
    contract_address: mint,
    markPrice: 100,
    markValuation: 1_000,
    tokenPrice: 110,
    impliedValuation: 1_100,
    supply: 10,
    ...overrides,
  };
}

test("official asset registry accepts a valid API response", () => {
  const result = parsePreStocksAssets([apiAsset()]);
  assert.equal(result[0].mint, mint);
  assert.equal(result[0].symbol, "SPACEX");
});

test("official asset registry rejects malformed assets and invalid mints", () => {
  assert.throws(() => parsePreStocksAssets([apiAsset({ symbol: "space x" })]));
  assert.throws(() => parsePreStocksAssets([apiAsset({ contract_address: "not-a-mint" })]));
  assert.throws(() => parsePreStocksAssets({ assets: [apiAsset()] }));
});

test("official asset registry rejects duplicate mints and symbols", () => {
  assert.throws(() => parsePreStocksAssets([apiAsset(), apiAsset({ symbol: "SPACEX2" })]), /duplicate token mints/);
  assert.throws(() => parsePreStocksAssets([apiAsset(), apiAsset({ contract_address: secondMint })]), /duplicate asset symbols/);
});
