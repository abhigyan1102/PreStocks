import { NextResponse } from "next/server";
import { makeChallenge } from "@/lib/radar/auth";
import { radarDb, readJson, sameOrigin } from "@/lib/radar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    const body = await readJson(request) as { wallet?: unknown };
    if (!body || typeof body.wallet !== "string") throw new Error("Wallet address required");
    const now = new Date();
    const domain = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    const challenge = makeChallenge(body.wallet, domain, now);
    const recent = await radarDb().from("radar_challenges").select("id", { count: "exact" })
      .eq("wallet_address", body.wallet).gte("created_at", new Date(now.getTime() - 60_000).toISOString()).limit(1);
    if (recent.error) throw new Error("Challenge limit unavailable");
    if ((recent.count ?? 0) >= 5) return NextResponse.json({ error: "Try again in a minute" }, { status: 429 });
    const result = await radarDb().from("radar_challenges").insert([{
      wallet_address: body.wallet, nonce_hash: challenge.nonceHash, message: challenge.message,
      issued_at: challenge.issuedAt, expires_at: challenge.expiresAt,
    }]).select("id").single();
    if (result.error || !result.data) throw new Error("Could not create challenge");
    return NextResponse.json({ challengeId: result.data.id, message: challenge.message, expiresAt: challenge.expiresAt },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid challenge request";
    return NextResponse.json({ error: message }, { status: message.includes("persistence") || message.includes("create challenge") ? 503 : 400 });
  }
}
