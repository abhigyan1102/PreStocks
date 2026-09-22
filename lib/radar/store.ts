import "server-only";
import { createAdminClient } from "@insforge/sdk";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sha256 } from "./auth";
import type { RadarBoard } from "./validation";

function admin() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Radar persistence is not configured");
  return createAdminClient({ baseUrl, apiKey });
}

function dataOrThrow<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw new Error("Radar persistence request failed");
  return result.data;
}

export const radarDb = () => admin().database;

export async function getBoard(): Promise<RadarBoard> {
  const result = await radarDb().rpc("radar_board");
  return dataOrThrow(result) as RadarBoard;
}

export async function getWalletSession(): Promise<string | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie || !/^[A-Za-z0-9_-]{43}$/.test(cookie)) return null;
  const result = await radarDb().from("radar_sessions")
    .select("wallet_address, expires_at").eq("token_hash", sha256(cookie)).limit(1).maybeSingle();
  if (result.error || !result.data || new Date(result.data.expires_at).getTime() <= Date.now()) return null;
  return result.data.wallet_address as string;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const received = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    return received.host === host && received.protocol === `${protocol}:`;
  } catch { return false; }
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 8_192) throw new Error("Payload too large");
  const text = await request.text();
  if (text.length > 8_192) throw new Error("Payload too large");
  return JSON.parse(text);
}
