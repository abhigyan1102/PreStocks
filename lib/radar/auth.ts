import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import bs58 from "bs58";
import { validateWalletAddress } from "@/lib/solana/wallet";
import { formatSignInMessage, type RadarSignInInput } from "./sign-in";

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

export function makeChallenge(wallet: string, origin: string, now = new Date()) {
  validateWalletAddress(wallet);
  const site = new URL(origin);
  if (!["http:", "https:"].includes(site.protocol) || site.origin !== origin) throw new Error("Invalid sign-in origin");
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS);
  const signInInput: RadarSignInInput = {
    domain: site.host, address: wallet, uri: site.origin, version: "1", chainId: "solana:mainnet", nonce,
    statement: "Sign in to PreStocks Radar to publish your community demand signal. This request does not authorize a transaction.",
    issuedAt: now.toISOString(), expirationTime: expiresAt.toISOString(),
  };
  const message = formatSignInMessage(signInInput);
  return { nonceHash: sha256(nonce), message, signInInput, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
}

export function verifyChallengeSignature(
  challenge: RadarChallenge,
  wallet: string,
  signatureBase64: string,
  signedMessage: string,
  expectedOrigin: string,
  now = new Date(),
): boolean {
  if (challenge.wallet_address !== wallet || challenge.consumed_at !== null ||
      !Number.isFinite(Date.parse(challenge.expires_at)) || Date.parse(challenge.expires_at) <= now.getTime() ||
      signedMessage !== challenge.message ||
      !/^[A-Za-z0-9+/]{86}==?$/.test(signatureBase64)) return false;
  try {
    const site = new URL(expectedOrigin);
    const lines = challenge.message.split("\n");
    if (site.origin !== expectedOrigin || lines[0] !== `${site.host} wants you to sign in with your Solana account:` ||
        lines[1] !== wallet || !lines.includes(`URI: ${site.origin}`)) return false;
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
