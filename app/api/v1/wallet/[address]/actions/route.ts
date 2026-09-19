import { NextResponse } from "next/server";
import { createActionKitPositions } from "@/lib/actionkit";
import { scanWalletContinuity } from "@/lib/continuity";
import { lifecycleProvider } from "@/lib/lifecycle";
import { transitionFromEvent } from "@/lib/lineage";
import { getPreStocks } from "@/lib/prestocks";
import { createWalletRpcClient, RpcConfigurationError, RpcRateLimitError, RpcReadError } from "@/lib/solana/rpc";
import { MalformedRpcResponseError, validateWalletAddress } from "@/lib/solana/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  try { validateWalletAddress(address); }
  catch { return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 }); }

  try {
    const rpc = createWalletRpcClient();
    const [assets, events] = await Promise.all([getPreStocks(), lifecycleProvider.getEvents()]);
    const { evaluations } = await scanWalletContinuity(address, assets, events, rpc);
    const positions = createActionKitPositions(evaluations, events.map(transitionFromEvent));
    return NextResponse.json({
      mode: "live",
      product: "PreStocks ActionKit",
      wallet: address,
      positions: positions.map((position) => ({
        symbol: position.asset.symbol,
        name: position.asset.name,
        mint: position.asset.mint,
        balance: position.holding.uiBalance,
        rawBalance: position.holding.rawBalance,
        decimals: position.holding.decimals,
        status: position.status,
        market: {
          tokenPrice: position.asset.tokenPrice,
          markPrice: position.asset.markPrice,
          source: "PRESTOCKS_OFFICIAL_API",
        },
        actions: position.actions,
      })),
      summary: {
        prestocksPositions: positions.length,
        positionsRequiringAction: positions.filter((position) => position.status === "ACTION_REQUIRED").length,
      },
      sources: {
        assets: "PRESTOCKS_OFFICIAL_API",
        balances: "SOLANA_RPC",
        lifecycle: "reviewed source snapshot",
        actions: "DERIVED",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RpcConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof RpcReadError || error instanceof MalformedRpcResponseError) {
      return NextResponse.json({ error: "Solana RPC lookup failed or returned invalid data" }, { status: 502 });
    }
    return NextResponse.json({ error: "Official asset or lifecycle data is unavailable" }, { status: 503 });
  }
}
