import { NextResponse } from "next/server";
import { getBoard, getWalletSession, radarDb, readJson, sameOrigin } from "@/lib/radar/store";
import { parseSubmission, ensureUnofficialCandidates } from "@/lib/radar/validation";
import { getPreStocks } from "@/lib/prestocks";
import { resolveHolder } from "@/lib/radar/holder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  const wallet = await getWalletSession();
  if (!wallet) return NextResponse.json({ error: "Connect and sign with your wallet first" }, { status: 401 });
  let submission;
  try {
    const [board, official] = await Promise.all([getBoard(), getPreStocks()]);
    ensureUnofficialCandidates(board.candidates.map((item) => item.name), official.map((item) => item.name));
    submission = parseSubmission(await readJson(request), board.candidates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission";
    return NextResponse.json({ error: message }, { status: message.includes("candidate registry") || message.includes("persistence") ? 503 : 400 });
  }
  try {
    const holder = await resolveHolder(wallet);
    const result = await radarDb().rpc("radar_replace_submission", {
      p_wallet_address: wallet,
      p_is_current_holder: holder.isCurrentPreStocksHolder,
      p_official_position_count: holder.officialPositionCount,
      p_reason: submission.reason,
      p_allocations: submission.allocations,
    });
    if (result.error || !result.data) throw new Error("Submission persistence failed");
    return NextResponse.json({ id: result.data, href: `/signal/${result.data}`, holder: holder.isCurrentPreStocksHolder },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Live holder check or submission is unavailable. Please try again." }, { status: 503 });
  }
}
