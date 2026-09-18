import { NextResponse } from "next/server";
import { loadLiveResolution, NoPreStocksPositionError, UnknownPreStocksAssetError } from "@/lib/continuity";
import { RpcConfigurationError, RpcRateLimitError, RpcReadError } from "@/lib/solana/rpc";
import { InvalidWalletAddressError, MalformedRpcResponseError } from "@/lib/solana/wallet";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Expected JSON body" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Expected wallet and symbol" }, { status: 400 });
  const { wallet, symbol } = body as Record<string, unknown>;
  if (typeof wallet !== "string" || typeof symbol !== "string") return NextResponse.json({ error: "Expected wallet and symbol" }, { status: 400 });
  try {
    const { asset, holding, plan } = await loadLiveResolution(wallet, symbol);
    return NextResponse.json({ mode: "live", position: { ...holding, symbol: asset.symbol }, resolution: plan }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidWalletAddressError || error instanceof UnknownPreStocksAssetError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof NoPreStocksPositionError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof RpcConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof RpcReadError || error instanceof MalformedRpcResponseError) return NextResponse.json({ error: "Solana RPC lookup failed or returned invalid data" }, { status: 502 });
    return NextResponse.json({ error: "Official asset or lifecycle data is unavailable" }, { status: 503 });
  }
}
