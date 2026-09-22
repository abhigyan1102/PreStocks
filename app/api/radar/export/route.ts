import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBoard, radarDb } from "@/lib/radar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const configured = process.env.RADAR_EXPORT_TOKEN;
  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!configured || !presented) return false;
  return timingSafeEqual(
    createHash("sha256").update(configured).digest(),
    createHash("sha256").update(presented).digest(),
  );
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const text = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [board, reasons] = await Promise.all([
      getBoard(),
      radarDb().from("radar_submissions").select("top_candidate_id, reason, is_current_holder, updated_at")
        .order("updated_at", { ascending: false }).limit(500),
    ]);
    if (reasons.error) throw new Error("Research export failed");
    const total = board.candidates.reduce((sum, candidate) => sum + candidate.totalPoints, 0);
    const rows = board.candidates.map((candidate) => ({
      candidate: candidate.name,
      totalPoints: candidate.totalPoints,
      percentage: total > 0 ? Number((candidate.totalPoints * 100 / total).toFixed(2)) : 0,
      allocatingWallets: candidate.allocatingWallets,
      holderPoints: candidate.holderPoints,
      holderWallets: candidate.holderWallets,
      communityPoints: candidate.communityPoints,
      communityWallets: candidate.communityWallets,
      reasons: (reasons.data ?? []).filter((item) => item.top_candidate_id === candidate.id)
        .map((item) => ({ text: item.reason, currentHolder: item.is_current_holder, updatedAt: item.updated_at })),
    }));
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "csv") {
      const headers = ["candidate", "total_points", "percentage", "allocating_wallets", "holder_points",
        "holder_wallets", "community_points", "community_wallets", "recent_reasons"];
      const lines = [headers.map(csvCell).join(","), ...rows.map((row) => [row.candidate, row.totalPoints,
        row.percentage, row.allocatingWallets, row.holderPoints, row.holderWallets, row.communityPoints,
        row.communityWallets, row.reasons.map((reason) => reason.text).join(" | ")].map(csvCell).join(","))];
      return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=prestocks-radar-aggregate.csv", "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ generatedAt: new Date().toISOString(), metrics: board.metrics, candidates: rows,
      reasonLimit: 500 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Research export unavailable" }, { status: 503 });
  }
}
