import { isAddress } from "@solana/kit";
import type { LifecycleEvent, SourceClass } from "./domain";

export interface LifecycleProviderInfo {
  id: string;
  mode: "reviewed-static" | "official-api" | "webhook" | "onchain";
  sourceType: SourceClass;
  description: string;
}

export interface LifecycleProvider {
  readonly info: LifecycleProviderInfo;
  getEvents(): Promise<LifecycleEvent[]>;
  getEventsForAsset(symbol: string): Promise<LifecycleEvent[]>;
  getActiveEvents(now?: Date): Promise<LifecycleEvent[]>;
}

export function validateLifecycleEvent(event: LifecycleEvent): LifecycleEvent {
  const required = [event.id, event.assetSymbol, event.assetMint, event.sourceName, event.sourceUrl, event.verifiedAt, event.actionLabel, event.actionUrl];
  if (required.some((value) => !value.trim())) throw new Error("Lifecycle event is missing provenance or identity");
  for (const urlValue of [event.sourceUrl, event.actionUrl]) {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || !["prestocks.com", "www.prestocks.com"].includes(url.hostname)) {
      throw new Error("Lifecycle event must link to an official HTTPS PreStocks page");
    }
  }
  if (!isAddress(event.assetMint)) throw new Error("Lifecycle event has an invalid source mint");
  if (event.destinationAssetMint && !isAddress(event.destinationAssetMint)) {
    throw new Error("Lifecycle event has an invalid destination mint");
  }
  if (event.destinationAssetMint === event.assetMint) {
    throw new Error("Lifecycle destination must differ from its source mint");
  }
  for (const value of [event.verifiedAt, event.announcedAt, event.effectiveAt, event.deadline]) {
    if (value && !Number.isFinite(Date.parse(value))) throw new Error("Lifecycle event has an invalid date");
  }
  if (event.conversionRatio !== null && !/^[1-9]\d*(?:\.\d+)?(?::[1-9]\d*(?:\.\d+)?)?$/.test(event.conversionRatio)) {
    throw new Error("Lifecycle event has an invalid conversion ratio");
  }
  if (event.sourceType !== "PRESTOCKS_OFFICIAL_PAGE") {
    throw new Error("Static lifecycle events require an official PreStocks page source");
  }
  if (event.destinationAssetMint && !event.destinationAssetSymbol) {
    throw new Error("Lifecycle destination mint requires a destination symbol");
  }
  if (event.executionMode === "SWAP" && !event.destinationAssetMint) {
    throw new Error("Swap lifecycle event requires a verified destination mint");
  }
  return structuredClone(event);
}

// Source checked 2026-09-18. This is a reviewed snapshot, not a live corporate-action feed.
const VERIFIED_EVENT_INPUT: LifecycleEvent[] = [
  {
    id: "prestocks-spacex-ipo-2027-03-12",
    assetSymbol: "SPACEX",
    assetMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    type: "IPO",
    status: "ACTION_REQUIRED",
    announcedAt: null,
    effectiveAt: null,
    deadline: "2027-03-12T23:59:00Z",
    actionLabel: "Review PreStocks swap instructions",
    actionUrl: "https://prestocks.com/spacex",
    sourceUrl: "https://prestocks.com/spacex",
    sourceName: "PreStocks SpaceX product page",
    sourceType: "PRESTOCKS_OFFICIAL_PAGE",
    verifiedAt: "2026-09-17T19:15:31Z",
    destinationAssetSymbol: null,
    destinationAssetMint: null,
    conversionRatio: null,
    executionMode: "UNKNOWN",
    notes: "PreStocks says SpaceX tokens must be swapped into SPCXx or another token before the deadline. No destination mint or executable route has been verified for this event.",
  },
];
const VERIFIED_EVENTS: readonly LifecycleEvent[] = VERIFIED_EVENT_INPUT.map(validateLifecycleEvent);

export class StaticVerifiedLifecycleProvider implements LifecycleProvider {
  readonly info: LifecycleProviderInfo = {
    id: "prestocks-reviewed-static-v1",
    mode: "reviewed-static",
    sourceType: "PRESTOCKS_OFFICIAL_PAGE",
    description: "Reviewed PreStocks pages stored as a versioned snapshot; not a corporate-actions API.",
  };

  private readonly events: readonly LifecycleEvent[];

  constructor(events: readonly LifecycleEvent[] = VERIFIED_EVENTS) {
    this.events = events.map(validateLifecycleEvent);
  }

  async getEvents(): Promise<LifecycleEvent[]> {
    return this.events.map((event) => structuredClone(event));
  }

  async getEventsForAsset(symbol: string): Promise<LifecycleEvent[]> {
    return this.events.filter((event) => event.assetSymbol === symbol.toUpperCase()).map((event) => structuredClone(event));
  }

  async getActiveEvents(now = new Date()): Promise<LifecycleEvent[]> {
    return this.events.filter((event) =>
      event.status !== "COMPLETED" && event.status !== "EXPIRED" &&
      (!event.deadline || Date.parse(event.deadline) > now.getTime()),
    ).map((event) => structuredClone(event));
  }
}

export const lifecycleProvider: LifecycleProvider = new StaticVerifiedLifecycleProvider();
