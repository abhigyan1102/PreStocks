import { NextResponse } from "next/server";
import { getPreStocks, premiumPercent } from "@/lib/prestocks";

export async function GET() {
  try {
    const assets = await getPreStocks();
    return NextResponse.json({
      source: "https://prestocks.com/api/prestocks",
      assets: assets.map((asset) => ({ ...asset, premiumPercent: premiumPercent(asset) })),
    });
  } catch {
    return NextResponse.json({ error: "Official PreStocks asset data is unavailable" }, { status: 503 });
  }
}
