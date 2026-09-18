import { NextResponse } from "next/server";
import { loadLiveResolution, NoPreStocksPositionError, UnknownPreStocksAssetError } from "@/lib/continuity";
import { assertFreshQuote, JupiterExecutionRouter, QuoteValidationError, quoteResolutionStatus, RouterConfigurationError, RouterReadError, type QuoteRequest } from "@/lib/execution";
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
    const { plan } = await loadLiveResolution(wallet, symbol);
    if (plan.status !== "ROUTE_CHECK_REQUIRED" || !plan.targetMint) {
      return NextResponse.json({ status: plan.status, officialInstructionsUrl: plan.officialInstructionsUrl, reason: "No verified executable destination is recorded" }, { headers: { "Cache-Control": "no-store" } });
    }
    const quoteRequest: QuoteRequest = { mode: "live", wallet, inputMint: plan.sourceMint, outputMint: plan.targetMint, inputRawAmount: plan.inputRawAmount };
    const router = new JupiterExecutionRouter();
    const quote = await router.getQuote(quoteRequest);
    if (quoteResolutionStatus(quoteRequest, quote) === "NO_EXECUTABLE_ROUTE") return NextResponse.json({ status: "NO_EXECUTABLE_ROUTE", officialInstructionsUrl: plan.officialInstructionsUrl }, { headers: { "Cache-Control": "no-store" } });
    const verified = assertFreshQuote(quoteRequest, quote);
    return NextResponse.json({
      status: "EXECUTABLE", provider: "Jupiter", input: { symbol, mint: verified.inputMint, rawAmount: verified.inputRawAmount },
      output: { mint: verified.outputMint, estimatedRawAmount: verified.outputRawAmount },
      router: verified.router, routeDetails: null, priceImpactPct: null, quoteTimestamp: verified.quoteTimestamp,
      signing: "not_enabled", officialInstructionsUrl: plan.officialInstructionsUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidWalletAddressError || error instanceof UnknownPreStocksAssetError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof NoPreStocksPositionError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof RpcConfigurationError || error instanceof RouterConfigurationError) return NextResponse.json({ error: error.message, status: "ROUTE_CHECK_REQUIRED" }, { status: 503 });
    if (error instanceof RpcRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof QuoteValidationError) return NextResponse.json({ status: "NO_EXECUTABLE_ROUTE", error: error.message }, { status: 409 });
    if (error instanceof RpcReadError || error instanceof MalformedRpcResponseError || error instanceof RouterReadError) return NextResponse.json({ error: "Live route verification failed" }, { status: 502 });
    return NextResponse.json({ error: "Official asset or lifecycle data is unavailable" }, { status: 503 });
  }
}
