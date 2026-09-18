import { NextResponse } from "next/server";
import { scanWalletContinuity } from "@/lib/continuity";
import { lifecycleProvider } from "@/lib/lifecycle";
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
    const { positions, evaluations } = await scanWalletContinuity(address, assets, events, rpc);
    return NextResponse.json({
      mode: "live",
      wallet: address,
      positions,
      evaluations,
      summary: {
        prestocksPositions: positions.length,
        positionsRequiringAction: positions.filter((item) => item.lifecycleState === "ACTION_REQUIRED").length,
      },
      evidence: { assetRegistry: "official PreStocks API", lifecycle: "reviewed source snapshot", balances: "finalized Solana RPC" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RpcConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof RpcReadError || error instanceof MalformedRpcResponseError) return NextResponse.json({ error: "Solana RPC lookup failed or returned invalid data" }, { status: 502 });
    return NextResponse.json({ error: "Official asset or lifecycle data is unavailable" }, { status: 503 });
  }
}
