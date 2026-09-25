import { NextResponse } from "next/server";
import { getBoard, radarDb } from "@/lib/radar/store";
import { getPreStocks } from "@/lib/prestocks";
import { ensureUnofficialCandidates } from "@/lib/radar/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [board, official, recent] = await Promise.all([
      getBoard(), getPreStocks(),
      radarDb().from("radar_submissions").select("top_candidate_id, reason, is_current_holder, updated_at")
        .order("updated_at", { ascending: false }).limit(32),
    ]);
    if (recent.error) throw new Error("Recent signal lookup failed");
    ensureUnofficialCandidates(board.candidates.map((item) => item.name), official.map((item) => item.name));
    const reasons = (recent.data ?? []).map((item) => ({ candidateId: item.top_candidate_id,
      reason: item.reason, isCurrentHolder: item.is_current_holder, updatedAt: item.updated_at }));
    return NextResponse.json({ ...board, reasons }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The demand board is temporarily unavailable" }, { status: 503 });
  }
}
