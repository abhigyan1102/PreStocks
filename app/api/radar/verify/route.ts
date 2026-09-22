import { NextResponse } from "next/server";
import { makeSessionToken, SESSION_COOKIE, SESSION_LIFETIME_MS, verifyChallengeSignature } from "@/lib/radar/auth";
import { radarDb, readJson, sameOrigin } from "@/lib/radar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    const body = await readJson(request) as Record<string, unknown>;
    if (!body || typeof body.challengeId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.challengeId) ||
        typeof body.wallet !== "string" || typeof body.signature !== "string" ||
        typeof body.signedMessage !== "string") throw new Error("Malformed verification request");
    const result = await radarDb().from("radar_challenges")
      .select("wallet_address, message, expires_at, consumed_at")
      .eq("id", body.challengeId).limit(1).maybeSingle();
    if (result.error) throw new Error("Challenge lookup failed");
    if (!result.data || !verifyChallengeSignature(result.data, body.wallet, body.signature, body.signedMessage)) {
      return NextResponse.json({ error: "Invalid or expired wallet signature" }, { status: 401 });
    }
    const consumed = await radarDb().from("radar_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", body.challengeId).is("consumed_at", null)
      .gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (consumed.error) throw new Error("Challenge consumption failed");
    if (!consumed.data) return NextResponse.json({ error: "Challenge already used or expired" }, { status: 401 });
    const session = makeSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const saved = await radarDb().from("radar_sessions").insert([{
      wallet_address: body.wallet, token_hash: session.tokenHash, expires_at: expiresAt.toISOString(),
    }]);
    if (saved.error) throw new Error("Session creation failed");
    const response = NextResponse.json({ wallet: body.wallet }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true, sameSite: "lax", secure: new URL(request.headers.get("origin")!).protocol === "https:",
      path: "/", expires: expiresAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: message.includes("failed") ? 503 : 400 });
  }
}
