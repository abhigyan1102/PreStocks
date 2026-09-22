import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import bs58 from "bs58";
import { makeChallenge, verifyChallengeSignature } from "./auth";

function fixture() {
  const keys = generateKeyPairSync("ed25519");
  const publicDer = keys.publicKey.export({ type: "spki", format: "der" });
  const wallet = bs58.encode(publicDer.subarray(-32));
  const now = new Date("2026-09-23T00:00:00.000Z");
  const made = makeChallenge(wallet, "127.0.0.1:3000", now);
  const challenge = { wallet_address: wallet, message: made.message, expires_at: made.expiresAt, consumed_at: null };
  const signature = sign(null, Buffer.from(made.message), keys.privateKey).toString("base64");
  return { keys, wallet, now, challenge, signature };
}

test("valid Solana Ed25519 signature authenticates exact challenge bytes", () => {
  const item = fixture();
  assert.equal(verifyChallengeSignature(item.challenge, item.wallet, item.signature,
    item.challenge.message, new Date(item.now.getTime() + 1000)), true);
});

test("invalid signature and wrong signing key are rejected", () => {
  const item = fixture();
  const wrong = generateKeyPairSync("ed25519");
  const wrongSignature = sign(null, Buffer.from(item.challenge.message), wrong.privateKey).toString("base64");
  assert.equal(verifyChallengeSignature(item.challenge, item.wallet, wrongSignature, item.challenge.message, item.now), false);
  assert.equal(verifyChallengeSignature(item.challenge, item.wallet, "broken", item.challenge.message, item.now), false);
});

test("wrong public key, modified message, expired challenge, and reused nonce fail", () => {
  const item = fixture();
  const other = generateKeyPairSync("ed25519");
  const otherWallet = bs58.encode(other.publicKey.export({ type: "spki", format: "der" }).subarray(-32));
  assert.equal(verifyChallengeSignature(item.challenge, otherWallet, item.signature, item.challenge.message, item.now), false);
  assert.equal(verifyChallengeSignature(item.challenge, item.wallet, item.signature, item.challenge.message + "!", item.now), false);
  assert.equal(verifyChallengeSignature(item.challenge, item.wallet, item.signature, item.challenge.message,
    new Date(item.challenge.expires_at)), false);
  assert.equal(verifyChallengeSignature({ ...item.challenge, consumed_at: item.now.toISOString() }, item.wallet,
    item.signature, item.challenge.message, item.now), false);
});
