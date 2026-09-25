import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sha256 } from "@/lib/radar/auth";
import { radarDb, sameOrigin } from "@/lib/radar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await radarDb().from("radar_sessions").delete().eq("token_hash", sha256(token));
  const response = NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
