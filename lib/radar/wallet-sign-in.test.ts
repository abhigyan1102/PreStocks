import assert from "node:assert/strict";
import test from "node:test";
import type { WalletAccount } from "@wallet-standard/base";
import { connectRadarWallet, signRadarChallenge, type SupportedWallet } from "./wallet-sign-in";
import { formatSignInMessage, type RadarSignInInput } from "./sign-in";

const origin = "https://radar.example";
const account: WalletAccount = { address: "11111111111111111111111111111111", publicKey: new Uint8Array(32), chains: ["solana:mainnet"], features: ["solana:signMessage"] };
function fixture(signIn?: (...args: unknown[]) => Promise<unknown>) {
  let messageCalls = 0;
  const input: RadarSignInInput = { domain: "radar.example", address: account.address, statement: "Sign in to Radar.", uri: origin,
    version: "1", chainId: "solana:mainnet", nonce: "12345678", issuedAt: new Date().toISOString(), expirationTime: new Date(Date.now() + 300000).toISOString() };
  const challenge = { challengeId: "challenge", message: formatSignInMessage(input), signInInput: input, expiresAt: input.expirationTime };
  const output = { account, signedMessage: new TextEncoder().encode(challenge.message), signature: new Uint8Array(64) };
  const wallet = { version: "1.0.0", name: "Test wallet", icon: "data:image/png;base64,", chains: ["solana:mainnet"], accounts: [account], features: {
    "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
    "solana:signMessage": { version: "1.0.0", signMessage: async () => { messageCalls++; return [output]; } },
    ...(signIn ? { "solana:signIn": { version: "1.0.0", signIn } } : {}),
  } } as unknown as SupportedWallet;
  return { wallet, challenge, output, messageCalls: () => messageCalls };
}

test("connecting does not request any signature", async () => {
  let signInCalls = 0;
  const f = fixture(async () => { signInCalls++; return []; });
  assert.equal((await connectRadarWallet(f.wallet)).address, account.address);
  assert.equal(signInCalls, 0);
  assert.equal(f.messageCalls(), 0);
});

test("SIWS rejection never retries through signMessage", async () => {
  const f = fixture(async () => { throw new Error("Blocked by wallet"); });
  await assert.rejects(signRadarChallenge(f.wallet, account, f.challenge, origin), /Blocked by wallet/);
  assert.equal(f.messageCalls(), 0);
});

test("legacy wallets sign the same SIWS bytes only on explicit sign request", async () => {
  const f = fixture();
  const result = await signRadarChallenge(f.wallet, account, f.challenge, origin);
  assert.equal(result.signedMessage, f.challenge.message);
  assert.equal(f.messageCalls(), 1);
});

test("changed account and modified message are rejected", async () => {
  const f = fixture(async () => [{ ...f.output, account: { ...account, address: "different" } }]);
  await assert.rejects(signRadarChallenge(f.wallet, account, f.challenge, origin), /account changed/);
  const modified = fixture(async () => [{ ...modified.output, signedMessage: new TextEncoder().encode("different") }]);
  await assert.rejects(signRadarChallenge(modified.wallet, account, modified.challenge, origin), /different message/);
});

test("cross-domain, modified and expired challenges never reach the wallet", async () => {
  const f = fixture();
  await assert.rejects(signRadarChallenge(f.wallet, account, f.challenge, "https://other.example"), /invalid or expired/);
  await assert.rejects(signRadarChallenge(f.wallet, account, { ...f.challenge, message: "different" }, origin), /invalid or expired/);
  const expired = new Date(Date.now() - 1).toISOString();
  const signInInput = { ...f.challenge.signInInput, expirationTime: expired };
  await assert.rejects(signRadarChallenge(f.wallet, account, { ...f.challenge, signInInput, expiresAt: expired, message: formatSignInMessage(signInInput) }, origin), /invalid or expired/);
  assert.equal(f.messageCalls(), 0);
});

test("native SIWS receives the exact challenge fields and does not use legacy signing", async () => {
  const f = fixture(async (...inputs) => {
    assert.deepEqual(inputs, [f.challenge.signInInput]);
    return [f.output];
  });
  const result = await signRadarChallenge(f.wallet, account, f.challenge, origin);
  assert.equal(result.wallet, account.address);
  assert.equal(result.signedMessage, f.challenge.message);
  assert.equal(f.messageCalls(), 0);
});
