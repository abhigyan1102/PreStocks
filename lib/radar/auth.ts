import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import bs58 from "bs58";
import { validateWalletAddress } from "@/lib/solana/wallet";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
export const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "radar_session";

export interface RadarChallenge {
  wallet_address: string;
  message: string;
  expires_at: string;
  consumed_at: string | null;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function makeChallenge(wallet: string, domain: string, now = new Date()) {
  validateWalletAddress(wallet);
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS);
  const message = [
    "PreStocks Radar wallet verification",
    `Domain: ${domain}`,
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued at: ${now.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
    "Purpose: Publish a 100-point community demand signal.",
    "This signature does not authorize a transaction.",
  ].join("\n");
  return { nonceHash: sha256(nonce), message, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
}

export function verifyChallengeSignature(
  challenge: RadarChallenge,
  wallet: string,
  signatureBase64: string,
  signedMessage: string,
  now = new Date(),
): boolean {
  if (challenge.wallet_address !== wallet || challenge.consumed_at !== null ||
      new Date(challenge.expires_at).getTime() <= now.getTime() ||
      signedMessage !== challenge.message ||
      !/^[A-Za-z0-9+/]{86}==?$/.test(signatureBase64)) return false;
  try {
    validateWalletAddress(wallet);
    const publicKeyBytes = bs58.decode(wallet);
    const signature = Buffer.from(signatureBase64, "base64");
    if (publicKeyBytes.length !== 32 || signature.length !== 64) return false;
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
      format: "der",
      type: "spki",
    });
    return verifySignature(null, Buffer.from(challenge.message, "utf8"), publicKey, signature);
  } catch { return false; }
}

export function makeSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}
