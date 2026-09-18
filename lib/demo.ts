import type { Holding, PreStockAsset } from "./domain";

const DEMO_AMOUNTS: Record<string, string> = {
  SPACEX: "12.40",
  OPENAI: "2.74",
  ANTHROPIC: "1.20",
};

export function demoHoldings(assets: PreStockAsset[]): Holding[] {
  return assets.flatMap((asset) => {
    const amount = DEMO_AMOUNTS[asset.symbol];
    if (!amount) return [];
    const decimals = 2;
    const rawBalance = String(Math.round(Number(amount) * 100));
    return [{
      wallet: "DEMO_WALLET",
      mint: asset.mint,
      rawBalance,
      decimals,
      uiBalance: amount,
      simulated: true,
    }];
  });
}
