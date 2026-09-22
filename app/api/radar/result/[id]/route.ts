import { NextResponse } from "next/server";
import { radarDb } from "@/lib/radar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "Result not found" }, { status: 404 });
  try {
    const result = await radarDb().from("radar_submissions")
      .select("id, is_current_holder, top_candidate_id, reason, updated_at")
      .eq("id", id).limit(1).maybeSingle();
    if (result.error) throw new Error("Result lookup failed");
    if (!result.data) return NextResponse.json({ error: "Result not found" }, { status: 404 });
    const [allocations, candidates] = await Promise.all([
      radarDb().from("radar_allocations").select("candidate_id, points").eq("submission_id", id).limit(8),
      radarDb().from("radar_candidates").select("id, name, display_order").limit(8),
    ]);
    if (allocations.error || candidates.error) throw new Error("Result lookup failed");
    const byId = new Map((candidates.data ?? []).map((item) => [item.id, item]));
    const rows = (allocations.data ?? []).map((item) => ({
      candidateId: item.candidate_id, name: byId.get(item.candidate_id)?.name ?? "Candidate",
      points: item.points, displayOrder: byId.get(item.candidate_id)?.display_order ?? 99,
    })).sort((a, b) => b.points - a.points || a.displayOrder - b.displayOrder);
    return NextResponse.json({ id, isCurrentHolder: result.data.is_current_holder,
      topCandidate: byId.get(result.data.top_candidate_id)?.name ?? "Candidate",
      reason: result.data.reason, updatedAt: result.data.updated_at,
      allocations: rows.map(({ candidateId, name, points }) => ({ candidateId, name, points })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Result temporarily unavailable" }, { status: 503 });
  }
}
