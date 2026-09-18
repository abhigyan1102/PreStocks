import type { GuardianEvaluation, Holding, LifecycleEvent, PreStockAsset } from "./domain";
import { evaluateHolding } from "./guardian";
import { lifecycleProvider } from "./lifecycle";
import { transitionFromEvent } from "./lineage";
import { getPreStocks } from "./prestocks";
import { createResolutionPlan } from "./resolution";
import { createWalletRpcClient } from "./solana/rpc";
import type { WalletRpcClient } from "./solana/rpc";
import { scanPreStocksWallet, validateWalletAddress } from "./solana/wallet";

export interface ContinuityPosition {
  symbol: string;
  mint: string;
  rawBalance: string;
  decimals: number;
  uiBalance: string;
  lifecycleState: GuardianEvaluation["lifecycle"]["state"];
  sourceEventId: string | null;
}

export async function scanWalletContinuity(
  wallet: string,
  assets: PreStockAsset[],
  events: LifecycleEvent[],
  rpcClient: WalletRpcClient,
): Promise<{ holdings: Holding[]; evaluations: GuardianEvaluation[]; positions: ContinuityPosition[] }> {
  const holdings = await scanPreStocksWallet(wallet, assets, rpcClient);
  const byMint = new Map(assets.map((asset) => [asset.mint, asset]));
  const evaluations = holdings.map((holding) => evaluateHolding(byMint.get(holding.mint)!, holding, events));
  const positions = evaluations.map((item) => ({
    symbol: item.asset.symbol,
    mint: item.asset.mint,
    rawBalance: item.holding.rawBalance,
    decimals: item.holding.decimals,
    uiBalance: item.holding.uiBalance,
    lifecycleState: item.lifecycle.state,
    sourceEventId: item.lifecycle.event?.id ?? null,
  }));
  return { holdings, evaluations, positions };
}

export class UnknownPreStocksAssetError extends Error {}
export class NoPreStocksPositionError extends Error {}

export async function loadLiveResolution(wallet: string, symbol: string) {
  validateWalletAddress(wallet);
  if (!/^[A-Za-z0-9]{1,24}$/.test(symbol)) throw new UnknownPreStocksAssetError("Invalid asset symbol");
  const rpc = createWalletRpcClient();
  const [assets, events] = await Promise.all([getPreStocks(), lifecycleProvider.getEvents()]);
  const asset = assets.find((item) => item.symbol === symbol.toUpperCase());
  if (!asset) throw new UnknownPreStocksAssetError("Unknown PreStocks asset");
  const { holdings } = await scanWalletContinuity(wallet, assets, events, rpc);
  const holding = holdings.find((item) => item.mint === asset.mint);
  if (!holding) throw new NoPreStocksPositionError("Wallet has no balance of this PreStocks asset");
  const plan = createResolutionPlan(asset, holding, events, events.map(transitionFromEvent));
  return { asset, holding, plan };
}
