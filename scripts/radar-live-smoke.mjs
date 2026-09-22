import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
import { createAdminClient } from "@insforge/sdk";

if (process.env.RADAR_LIVE_TEST !== "1") throw new Error("Set RADAR_LIVE_TEST=1 to run this live database check");
const base = process.env.RADAR_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const project = JSON.parse(readFileSync(".insforge/project.json", "utf8"));
const db = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key }).database;
const keys = generateKeyPairSync("ed25519");
const wallet = bs58.encode(keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32));
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((line) => line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));

async function request(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { Origin: base, ...(init.headers ?? {}) } });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
}
async function post(path, body, cookie) {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}

try {
  const boardBefore = await request("/api/radar/board");
  assert.equal(boardBefore.status, 200);
  const stripe = boardBefore.body.candidates.find((item) => item.slug === "stripe");
  const canva = boardBefore.body.candidates.find((item) => item.slug === "canva");
  const challenge = await post("/api/radar/challenge", { wallet });
  assert.equal(challenge.status, 200);
  const signature = sign(null, Buffer.from(challenge.body.message), keys.privateKey).toString("base64");
  const verified = await post("/api/radar/verify", { challengeId: challenge.body.challengeId, wallet,
    signature, signedMessage: challenge.body.message });
  assert.equal(verified.status, 200);
  const cookie = verified.cookie.split(";")[0];
  const first = await post("/api/radar/submit", { reason: "I want broader access to payment infrastructure.",
    allocations: [{ candidateId: stripe.id, points: 100 }] }, cookie);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const afterFirst = await request("/api/radar/board");
  assert.equal(afterFirst.body.metrics.currentSubmissions, boardBefore.body.metrics.currentSubmissions + 1);
  assert.equal(afterFirst.body.candidates.find((item) => item.id === stripe.id).totalPoints, stripe.totalPoints + 100);
  const second = await post("/api/radar/submit", { reason: "Design tools should be easier to access.",
    allocations: [{ candidateId: stripe.id, points: 40 }, { candidateId: canva.id, points: 60 }] }, cookie);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.id, first.body.id);
  const afterSecond = await request("/api/radar/board");
  assert.equal(afterSecond.body.metrics.currentSubmissions, boardBefore.body.metrics.currentSubmissions + 1);
  assert.equal(afterSecond.body.candidates.find((item) => item.id === stripe.id).totalPoints, stripe.totalPoints + 40);
  assert.equal(afterSecond.body.candidates.find((item) => item.id === canva.id).totalPoints, canva.totalPoints + 60);
  assert.equal(afterSecond.body.candidates.find((item) => item.id === canva.id).communityPoints, canva.communityPoints + 60);
  const result = await request(`/api/radar/result/${first.body.id}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.topCandidate, "Canva");
  assert.equal(result.body.allocations.reduce((sum, item) => sum + item.points, 0), 100);
  const denied = await request("/api/radar/export");
  assert.equal(denied.status, 401);
  const exported = await request("/api/radar/export", { headers: { Authorization: `Bearer ${env.RADAR_EXPORT_TOKEN}` } });
  assert.equal(exported.status, 200);
  assert.equal(exported.body.candidates.find((item) => item.candidate === "Canva").totalPoints, canva.totalPoints + 60);
  console.log("Live Radar smoke passed: signature, non-holder scan, replace, aggregate, result, protected export.");
  if (process.env.RADAR_VISUAL_HOLD_MS) {
    console.log(`Temporary result path for visual review: /signal/${first.body.id}`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(Number(process.env.RADAR_VISUAL_HOLD_MS), 120_000)));
  }
} finally {
  await db.from("radar_submissions").delete().eq("wallet_address", wallet);
  await db.from("radar_sessions").delete().eq("wallet_address", wallet);
  await db.from("radar_challenges").delete().eq("wallet_address", wallet);
  console.log("Synthetic test identity and submission cleaned.");
}
