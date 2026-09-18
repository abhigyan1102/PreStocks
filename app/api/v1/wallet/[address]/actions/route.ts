import { NextResponse } from "next/server";
import { evaluateHolding } from "@/lib/guardian";
import { lifecycleProvider } from "@/lib/lifecycle";
import { getPreStocks } from "@/lib/prestocks";
import { createWalletRpcClient, RpcConfigurationError, RpcRateLimitError, RpcReadError } from "@/lib/solana/rpc";
import { InvalidWalletAddressError, MalformedRpcResponseError, scanPreStocksWallet, validateWalletAddress } from "@/lib/solana/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  try {
    validateWalletAddress(address);
  } catch {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  try {
    const rpcClient = createWalletRpcClient();
    const assets = await getPreStocks();
    const holdings = await scanPreStocksWallet(address, assets, rpcClient);
    const events = await lifecycleProvider.getEvents();
    const byMint = new Map(assets.map((asset) => [asset.mint, asset]));
    const evaluations = holdings.map((holding) => evaluateHolding(byMint.get(holding.mint)!, holding, events));
    const actionRequired = evaluations.filter((item) => item.lifecycle.state === "ACTION_REQUIRED");
    return NextResponse.json({
      mode: "live",
      wallet: address,
      holdings: holdings.map(({ mint, rawBalance, decimals, uiBalance }) => ({
        symbol: byMint.get(mint)!.symbol, mint, rawBalance, decimals, uiBalance,
      })),
      evaluations,
      actionRequired,
      summary: {
        prestocksHoldings: holdings.length,
        activeEvents: evaluations.filter((item) => ["ACTION_REQUIRED", "WATCH", "MIGRATING"].includes(item.lifecycle.state)).length,
        criticalActions: actionRequired.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidWalletAddressError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RpcConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof RpcReadError) return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof MalformedRpcResponseError) return NextResponse.json({ error: "Solana RPC returned malformed token-account data" }, { status: 502 });
    return NextResponse.json({ error: "Official PreStocks asset data or lifecycle events are unavailable" }, { status: 503 });
  }
}
