import assert from "node:assert/strict";
import test from "node:test";
import type { PreStockAsset } from "../domain";
import { formatTokenAmount } from "./balances";
import { TOKEN_PROGRAMS, type WalletRpcClient } from "./rpc";
import { InvalidWalletAddressError, MalformedRpcResponseError, scanPreStocksWallet } from "./wallet";

const wallet = "11111111111111111111111111111111";
const spacexMint = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const secondMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const unknownMint = "So11111111111111111111111111111111111111112";
const accountA = "Vote111111111111111111111111111111111111111";
const accountB = "Stake11111111111111111111111111111111111111";
const asset = (mint: string, symbol: string): PreStockAsset => ({
  name: symbol, symbol, mint, description: "", image: "", externalUrl: "",
  markPrice: null, markValuation: null, tokenPrice: null, impliedValuation: null, supply: null,
});
const assets = [asset(spacexMint, "SPACEX"), asset(secondMint, "OTHER")];

function token(pubkey: string, mint: string, amount: string, decimals = 6, programId: string = TOKEN_PROGRAMS[0]) {
  return { pubkey, account: { owner: programId, data: { parsed: { type: "account", info: {
    owner: wallet, mint, tokenAmount: { amount, decimals, uiAmount: 0, uiAmountString: "untrusted" },
  } } } } };
}
function rpc(first: unknown[], second: unknown[] = []): WalletRpcClient {
  return { async getTokenAccountsByOwner(_owner, programId) { return { value: programId === TOKEN_PROGRAMS[0] ? first : second }; } };
}

test("one official PreStocks token is a live holding", async () => {
  const result = await scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "12400000")]));
  assert.deepEqual(result, [{ wallet, mint: spacexMint, rawBalance: "12400000", decimals: 6, uiBalance: "12.400000", simulated: false }]);
});

test("multiple official mints yield separate holdings", async () => {
  const result = await scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "1"), token(accountB, secondMint, "3250000")]));
  assert.deepEqual(result.map((holding) => holding.mint), [spacexMint, secondMint]);
});

test("wallet without PreStocks tokens yields no holdings", async () => {
  assert.deepEqual(await scanPreStocksWallet(wallet, assets, rpc([])), []);
});

test("multiple accounts for one mint aggregate as integers", async () => {
  const result = await scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "9007199254740993"), token(accountB, spacexMint, "7")]));
  assert.equal(result[0].rawBalance, "9007199254741000");
  assert.equal(result[0].uiBalance, "9007199254.741000");
});

test("unknown mints are ignored even when their metadata resembles PreStocks", async () => {
  assert.deepEqual(await scanPreStocksWallet(wallet, assets, rpc([token(accountA, unknownMint, "123")])), []);
});

test("zero balances are ignored", async () => {
  assert.deepEqual(await scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "0")])), []);
});

test("duplicate accounts are counted once", async () => {
  const same = token(accountA, spacexMint, "123");
  const result = await scanPreStocksWallet(wallet, assets, rpc([same, same]));
  assert.equal(result[0].rawBalance, "123");
});

test("conflicting duplicate account responses fail closed", async () => {
  await assert.rejects(scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "123"), token(accountA, spacexMint, "124")])), MalformedRpcResponseError);
});

test("Token-2022 accounts are scanned", async () => {
  const result = await scanPreStocksWallet(wallet, assets, rpc([], [token(accountA, spacexMint, "7", 6, TOKEN_PROGRAMS[1])]));
  assert.equal(result[0].rawBalance, "7");
});

test("invalid wallet is rejected before RPC calls", async () => {
  let calls = 0;
  await assert.rejects(scanPreStocksWallet("not-a-wallet", assets, { async getTokenAccountsByOwner() { calls++; return { value: [] }; } }), InvalidWalletAddressError);
  assert.equal(calls, 0);
});

test("malformed RPC result is rejected", async () => {
  await assert.rejects(scanPreStocksWallet(wallet, assets, { async getTokenAccountsByOwner() { return { value: "wrong" }; } }), MalformedRpcResponseError);
});

test("malformed token amount is rejected", async () => {
  await assert.rejects(scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "1.5")])), MalformedRpcResponseError);
});

test("RPC failure propagates and does not return partial balances", async () => {
  await assert.rejects(scanPreStocksWallet(wallet, assets, { async getTokenAccountsByOwner() { throw new Error("RPC offline"); } }), /RPC offline/);
});

test("decimal conversion preserves exact fractional digits", () => {
  assert.equal(formatTokenAmount(1n, 9), "0.000000001");
  assert.equal(formatTokenAmount(1234000000n, 9), "1.234000000");
  assert.equal(formatTokenAmount(42n, 0), "42");
});

test("conflicting decimals for one official mint fail closed", async () => {
  await assert.rejects(scanPreStocksWallet(wallet, assets, rpc([token(accountA, spacexMint, "1", 6), token(accountB, spacexMint, "1", 9)])), MalformedRpcResponseError);
});
