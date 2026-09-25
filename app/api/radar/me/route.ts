import { NextResponse } from "next/server";
import { getWalletSession, radarDb } from "@/lib/radar/store";
import { resolveHolder } from "@/lib/radar/holder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const wallet = await getWalletSession();
  if (!wallet) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const holder = await resolveHolder(wallet);
    const existing = await radarDb().from("radar_submissions").select("id, reason, updated_at")
      .eq("wallet_address", wallet).limit(1).maybeSingle();
    if (existing.error) throw new Error("Submission lookup failed");
    let allocations: { candidateId: string; points: number }[] = [];
    if (existing.data) {
      const rows = await radarDb().from("radar_allocations").select("candidate_id, points")
        .eq("submission_id", existing.data.id).limit(8);
      if (rows.error) throw new Error("Allocation lookup failed");
      allocations = (rows.data ?? []).map((row) => ({ candidateId: row.candidate_id, points: row.points }));
    }
    return NextResponse.json({ authenticated: true, wallet, ...holder, pointsBudget: 100,
      submission: existing.data ? { id: existing.data.id, reason: existing.data.reason,
        updatedAt: existing.data.updated_at, allocations } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Holder verification or submission lookup unavailable" }, { status: 503 });
  }
}
