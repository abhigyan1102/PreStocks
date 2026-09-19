import { NextResponse } from "next/server";
import { lifecycleProvider } from "@/lib/lifecycle";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  if (!/^[A-Za-z0-9]{1,24}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid asset symbol" }, { status: 400 });
  }
  const events = await lifecycleProvider.getEventsForAsset(symbol);
  return NextResponse.json({ provider: lifecycleProvider.info, provenance: "reviewed static source snapshot", events });
}
