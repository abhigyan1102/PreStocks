import type { PreStockAsset } from "./domain";

const API_URL = "https://prestocks.com/api/prestocks";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface ApiAsset {
  name: unknown;
  symbol: unknown;
  description: unknown;
  image: unknown;
  external_url: unknown;
  contract_address: unknown;
  markPrice: unknown;
  markValuation: unknown;
  tokenPrice: unknown;
  impliedValuation: unknown;
  supply: unknown;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function officialUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "prestocks.com" || url.hostname === "www.prestocks.com")
      ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseAsset(value: unknown): PreStockAsset {
  if (!value || typeof value !== "object") throw new Error("Invalid PreStocks asset");
  const input = value as ApiAsset;
  if (
    typeof input.name !== "string" ||
    typeof input.symbol !== "string" ||
    !/^[A-Z0-9]{1,24}$/.test(input.symbol) ||
    typeof input.contract_address !== "string" ||
    !BASE58.test(input.contract_address)
  ) {
    throw new Error("PreStocks asset is missing identity fields");
  }
  return {
    name: input.name,
    symbol: input.symbol,
    description: typeof input.description === "string" ? input.description : "",
    image: officialUrl(input.image),
    externalUrl: officialUrl(input.external_url),
    mint: input.contract_address,
    markPrice: nullableNumber(input.markPrice),
    markValuation: nullableNumber(input.markValuation),
    tokenPrice: nullableNumber(input.tokenPrice),
    impliedValuation: nullableNumber(input.impliedValuation),
    supply: nullableNumber(input.supply),
  };
}

export async function getPreStocks(): Promise<PreStockAsset[]> {
  const response = await fetch(API_URL, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`PreStocks API returned ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("PreStocks API returned an invalid list");
  const assets = data.map(parseAsset);
  if (new Set(assets.map((asset) => asset.mint)).size !== assets.length) {
    throw new Error("PreStocks API returned duplicate token mints");
  }
  return assets;
}

export function premiumPercent(asset: PreStockAsset): number | null {
  if (asset.markPrice === null || asset.markPrice <= 0 || asset.tokenPrice === null) return null;
  return ((asset.tokenPrice - asset.markPrice) / asset.markPrice) * 100;
}
