import { NextResponse } from "next/server";
import { getPositionLineage, transitionFromEvent } from "@/lib/lineage";
import { lifecycleProvider } from "@/lib/lifecycle";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  if (!/^[A-Za-z0-9]{1,24}$/.test(symbol)) return NextResponse.json({ error: "Invalid asset symbol" }, { status: 400 });
  const events = await lifecycleProvider.getEvents();
  return NextResponse.json(getPositionLineage(symbol, events.map(transitionFromEvent)));
}
