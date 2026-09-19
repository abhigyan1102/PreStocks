import assert from "node:assert/strict";
import test from "node:test";
import { ActionKitRequestError, PreStocksActionKit } from "./actionkit";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

test("SDK maps asset, wallet, lineage, and resolution methods to the public API", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    requests.push({ url, init });
    if (url.endsWith("/assets")) return json({ source: "official", assets: [{ symbol: "SPACEX" }] });
    if (url.endsWith("/prestocks")) return json({ mode: "live", positions: [] });
    if (url.endsWith("/actions")) return json({ mode: "live", positions: [] });
    if (url.includes("/lineage/")) return json({ provider: { id: "reviewed" }, lineage: { origin: "SPACEX" } });
    return json({ mode: "live", resolution: { status: "MANUAL_ACTION_REQUIRED" } });
  };
  const kit = new PreStocksActionKit({ baseUrl: "https://example.com/", fetch: fetcher as typeof fetch });

  assert.equal((await kit.assets.get("spacex"))?.symbol, "SPACEX");
  await kit.wallet.getHoldings("wallet/with slash");
  await kit.wallet.getActions("wallet");
  await kit.lifecycle.getLineage("SPACEX");
  await kit.resolve.plan({ wallet: "wallet", symbol: "SPACEX" });

  assert.equal(requests[0].url, "https://example.com/api/v1/assets");
  assert.equal(requests[1].url, "https://example.com/api/v1/wallet/wallet%2Fwith%20slash/prestocks");
  assert.equal(requests[3].url, "https://example.com/api/v1/lineage/SPACEX");
  assert.equal(requests[4].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[4].init?.body)), { wallet: "wallet", symbol: "SPACEX" });
  assert.equal((requests[4].init?.headers as Record<string, string>).Accept, "application/json");
});

test("SDK exposes API errors with status and payload", async () => {
  const kit = new PreStocksActionKit({
    fetch: (async () => json({ error: "RPC unavailable" }, 503)) as typeof fetch,
  });
  await assert.rejects(
    () => kit.wallet.getActions("wallet"),
    (error: unknown) => error instanceof ActionKitRequestError && error.status === 503 && error.message === "RPC unavailable",
  );
});

test("SDK rejects non-JSON upstream responses", async () => {
  const kit = new PreStocksActionKit({
    fetch: (async () => new Response("gateway failure", { status: 502 })) as typeof fetch,
  });
  await assert.rejects(
    () => kit.assets.list(),
    (error: unknown) => error instanceof ActionKitRequestError && error.status === 502 && /non-JSON/.test(error.message),
  );
});

test("SDK invokes browser fetch without binding it to the client", async () => {
  const fetcher = function (this: unknown) {
    assert.equal(this, undefined);
    return Promise.resolve(json({ source: "official", assets: [] }));
  };
  const kit = new PreStocksActionKit({ fetch: fetcher as typeof fetch });
  await kit.assets.list();
});
