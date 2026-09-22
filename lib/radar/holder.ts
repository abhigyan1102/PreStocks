import { getPreStocks } from "@/lib/prestocks";
import { createWalletRpcClient } from "@/lib/solana/rpc";
import { scanPreStocksWallet } from "@/lib/solana/wallet";

export async function resolveHolder(wallet: string) {
  const assets = await getPreStocks();
  const positions = await scanPreStocksWallet(wallet, assets, createWalletRpcClient());
  return { isCurrentPreStocksHolder: positions.length > 0, officialPositionCount: positions.length };
}
