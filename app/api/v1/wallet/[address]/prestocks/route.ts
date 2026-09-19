import { NextResponse } from "next/server";
import { getPreStocks } from "@/lib/prestocks";
import { createWalletRpcClient, RpcConfigurationError, RpcRateLimitError, RpcReadError } from "@/lib/solana/rpc";
import { MalformedRpcResponseError, scanPreStocksWallet, validateWalletAddress } from "@/lib/solana/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  try { validateWalletAddress(address); }
  catch { return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 }); }

  try {
    const rpc = createWalletRpcClient();
    const assets = await getPreStocks();
    const holdings = await scanPreStocksWallet(address, assets, rpc);
    const byMint = new Map(assets.map((asset) => [asset.mint, asset]));
    const positions = holdings.map((holding) => ({
      symbol: byMint.get(holding.mint)!.symbol,
      mint: holding.mint,
      rawBalance: holding.rawBalance,
      decimals: holding.decimals,
      uiBalance: holding.uiBalance,
    }));
    return NextResponse.json({
      mode: "live",
      wallet: address,
      positions,
      summary: { prestocksPositions: positions.length },
      sources: { assetRegistry: "PRESTOCKS_OFFICIAL_API", balances: "SOLANA_RPC" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RpcConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof RpcReadError || error instanceof MalformedRpcResponseError) {
      return NextResponse.json({ error: "Solana RPC lookup failed or returned invalid data" }, { status: 502 });
    }
    return NextResponse.json({ error: "Official PreStocks asset data is unavailable" }, { status: 503 });
  }
}
