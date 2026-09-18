import { isAddress } from "@solana/kit";
import type { Holding, PreStockAsset } from "../domain";
import { formatTokenAmount } from "./balances";
import { TOKEN_PROGRAMS, type WalletRpcClient } from "./rpc";

const U64_MAX = (1n << 64n) - 1n;

export class InvalidWalletAddressError extends Error {}
export class MalformedRpcResponseError extends Error {}

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MalformedRpcResponseError("Malformed Solana RPC token-account response");
  }
  return value as RecordValue;
}

export function validateWalletAddress(value: string): void {
  if (!isAddress(value)) throw new InvalidWalletAddressError("Invalid Solana wallet address");
}

interface ParsedTokenAccount {
  pubkey: string;
  mint: string;
  amount: bigint;
  decimals: number;
}

function parseAccounts(response: unknown, owner: string, programId: string): ParsedTokenAccount[] {
  const value = object(response).value;
  if (!Array.isArray(value)) throw new MalformedRpcResponseError("Malformed Solana RPC token-account response");
  return value.map((entry) => {
    const keyed = object(entry);
    const account = object(keyed.account);
    const data = object(account.data);
    const parsed = object(data.parsed);
    const info = object(parsed.info);
    const tokenAmount = object(info.tokenAmount);
    const amount = tokenAmount.amount;
    const decimals = tokenAmount.decimals;
    if (
      typeof keyed.pubkey !== "string" || !isAddress(keyed.pubkey) ||
      account.owner !== programId || parsed.type !== "account" ||
      info.owner !== owner || typeof info.mint !== "string" || !isAddress(info.mint) ||
      typeof amount !== "string" || !/^(0|[1-9]\d*)$/.test(amount) ||
      !Number.isInteger(decimals) || (decimals as number) < 0 || (decimals as number) > 255
    ) throw new MalformedRpcResponseError("Malformed Solana RPC token-account response");
    const raw = BigInt(amount);
    if (raw > U64_MAX) throw new MalformedRpcResponseError("Malformed Solana RPC token-account response");
    return { pubkey: keyed.pubkey, mint: info.mint, amount: raw, decimals: decimals as number };
  });
}

/** Scan both token programs, then match only official PreStocks mint addresses. */
export async function scanPreStocksWallet(
  wallet: string,
  officialAssets: PreStockAsset[],
  rpcClient: WalletRpcClient,
): Promise<Holding[]> {
  validateWalletAddress(wallet);
  const trustedMints = new Set(officialAssets.map((asset) => asset.mint));
  const seen = new Map<string, ParsedTokenAccount>();
  const totals = new Map<string, { raw: bigint; decimals: number }>();
  for (const programId of TOKEN_PROGRAMS) {
    const response = await rpcClient.getTokenAccountsByOwner(wallet, programId);
    for (const item of parseAccounts(response, wallet, programId)) {
      const previousAccount = seen.get(item.pubkey);
      if (previousAccount) {
        if (previousAccount.mint !== item.mint || previousAccount.amount !== item.amount || previousAccount.decimals !== item.decimals) {
          throw new MalformedRpcResponseError("Conflicting duplicate token account");
        }
        continue;
      }
      seen.set(item.pubkey, item);
      if (!trustedMints.has(item.mint) || item.amount === 0n) continue;
      const previous = totals.get(item.mint);
      if (previous && previous.decimals !== item.decimals) {
        throw new MalformedRpcResponseError("Conflicting decimals for a PreStocks mint");
      }
      totals.set(item.mint, { raw: (previous?.raw ?? 0n) + item.amount, decimals: item.decimals });
    }
  }
  return officialAssets.flatMap((asset) => {
    const balance = totals.get(asset.mint);
    return balance ? [{
      wallet,
      mint: asset.mint,
      rawBalance: balance.raw.toString(),
      decimals: balance.decimals,
      uiBalance: formatTokenAmount(balance.raw, balance.decimals),
      simulated: false,
    }] : [];
  });
}
