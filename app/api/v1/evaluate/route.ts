import { NextResponse } from "next/server";
import { getPreStocks } from "@/lib/prestocks";
import { lifecycleProvider } from "@/lib/lifecycle";
import { evaluateHolding } from "@/lib/guardian";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object" }, { status: 400 });
  }
  const { symbol, simulatedBalance } = body as Record<string, unknown>;
  if (typeof symbol !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid asset symbol" }, { status: 400 });
  }
  if (typeof simulatedBalance !== "number" || !Number.isFinite(simulatedBalance) || simulatedBalance < 0.01 || simulatedBalance > 1e9 ||
      Math.abs(simulatedBalance * 100 - Math.round(simulatedBalance * 100)) > 1e-6) {
    return NextResponse.json({ error: "simulatedBalance must be 0.01 to 1e9 with at most two decimals" }, { status: 400 });
  }
  try {
    const assets = await getPreStocks();
    const asset = assets.find((candidate) => candidate.symbol === symbol.toUpperCase());
    if (!asset) return NextResponse.json({ error: "Unknown PreStocks asset" }, { status: 404 });
    const holding = {
      wallet: "DEMO_WALLET",
      mint: asset.mint,
      rawBalance: String(Math.round(simulatedBalance * 100)),
      decimals: 2,
      uiBalance: simulatedBalance.toFixed(2),
      simulated: true,
    };
    const events = await lifecycleProvider.getEventsForAsset(asset.symbol);
    return NextResponse.json({ mode: "simulation", evaluation: evaluateHolding(asset, holding, events) });
  } catch {
    return NextResponse.json({ error: "Official PreStocks asset data is unavailable" }, { status: 503 });
  }
}
