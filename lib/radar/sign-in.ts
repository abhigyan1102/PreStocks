import type { SolanaSignInInput } from "@solana/wallet-standard-features";

export type RadarSignInInput = Required<Pick<SolanaSignInInput,
  "domain" | "address" | "statement" | "uri" | "version" | "chainId" | "nonce" | "issuedAt" | "expirationTime">>;

// The SIWS text form is also used by wallets without the solana:signIn feature.
export function formatSignInMessage(input: RadarSignInInput): string {
  return [
    `${input.domain} wants you to sign in with your Solana account:`, input.address, "", input.statement, "",
    `URI: ${input.uri}`, `Version: ${input.version}`, `Chain ID: ${input.chainId}`, `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`, `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}
