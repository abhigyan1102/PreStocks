import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignIn, SolanaSignMessage, type SolanaSignInFeature, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { formatSignInMessage, type RadarSignInInput } from "./sign-in";

export type SupportedWallet = Wallet & { features: StandardConnectFeature };
export type SignInChallenge = { challengeId: string; message: string; expiresAt: string; signInInput: RadarSignInInput };

export function supportsRadar(wallet: Wallet): wallet is SupportedWallet {
  const features = wallet.features as Partial<StandardConnectFeature & SolanaSignInFeature & SolanaSignMessageFeature>;
  return typeof features[StandardConnect]?.connect === "function" &&
    (typeof features[SolanaSignIn]?.signIn === "function" || typeof features[SolanaSignMessage]?.signMessage === "function");
}

// Connection is deliberately separate from signing. It only requests account access.
export async function connectRadarWallet(wallet: SupportedWallet): Promise<WalletAccount> {
  const { accounts } = await wallet.features[StandardConnect].connect();
  const account = accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")) &&
    (Boolean(wallet.features[SolanaSignIn]) || item.features.includes(SolanaSignMessage)));
  if (!account) throw new Error("No compatible Solana account was returned by this wallet.");
  return account;
}

export async function signRadarChallenge(wallet: SupportedWallet, account: WalletAccount, challenge: SignInChallenge, origin: string) {
  const input = challenge.signInInput;
  if (input.uri !== origin || input.domain !== new URL(origin).host || input.address !== account.address ||
      formatSignInMessage(input) !== challenge.message || !Number.isFinite(Date.parse(challenge.expiresAt)) ||
      challenge.expiresAt !== input.expirationTime || Date.parse(challenge.expiresAt) <= Date.now()) {
    throw new Error("This sign-in request is invalid or expired. Close this window and connect again.");
  }
  const signIn = wallet.features[SolanaSignIn] as SolanaSignInFeature[typeof SolanaSignIn] | undefined;
  const signMessage = wallet.features[SolanaSignMessage] as SolanaSignMessageFeature[typeof SolanaSignMessage] | undefined;
  // A rejection is final. Never retry through a different signing method.
  const output = signIn ? (await signIn.signIn(input))[0] :
    signMessage ? (await signMessage.signMessage({ account, message: new TextEncoder().encode(challenge.message) }))[0] : undefined;
  if (!output) throw new Error("The wallet did not return a signature.");
  if ("account" in output && (output.account as WalletAccount).address !== account.address) {
    throw new Error("The signing account changed. Close this window and connect the intended account.");
  }
  const signedMessage = new TextDecoder("utf-8", { fatal: true }).decode(output.signedMessage);
  if (signedMessage !== challenge.message || output.signature.length !== 64 ||
      (output.signatureType && output.signatureType !== "ed25519")) {
    throw new Error("The wallet returned a different message or an unsupported signature format.");
  }
  return { challengeId: challenge.challengeId, wallet: account.address, signedMessage,
    signature: btoa(String.fromCharCode(...output.signature)) };
}
