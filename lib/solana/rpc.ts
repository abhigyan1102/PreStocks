import { address, createSolanaRpc } from "@solana/kit";

// The two official Solana token programs. Both can own token accounts.
export const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
] as const;

export interface WalletRpcClient {
  getTokenAccountsByOwner(owner: string, programId: string): Promise<unknown>;
}

export class RpcConfigurationError extends Error {}
export class RpcRateLimitError extends Error {}
export class RpcReadError extends Error {}

export function createWalletRpcClient(rpcUrl = process.env.SOLANA_RPC_URL): WalletRpcClient {
  if (!rpcUrl?.trim()) throw new RpcConfigurationError("SOLANA_RPC_URL is required for live wallet scans");
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    throw new RpcConfigurationError("SOLANA_RPC_URL is invalid");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new RpcConfigurationError("SOLANA_RPC_URL must use HTTPS or local HTTP");
  }
  const rpc = createSolanaRpc(rpcUrl);
  return {
    async getTokenAccountsByOwner(owner, programId) {
      try {
        return await rpc.getTokenAccountsByOwner(
          address(owner),
          { programId: address(programId) },
          { commitment: "finalized", encoding: "jsonParsed" },
        ).send({ abortSignal: AbortSignal.timeout(10000) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/\b429\b|rate.limit|too many requests/i.test(message)) {
          throw new RpcRateLimitError("Solana RPC rate limit reached");
        }
        throw new RpcReadError("Solana RPC token-account lookup failed");
      }
    },
  };
}
