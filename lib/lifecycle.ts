import type { LifecycleEvent } from "./domain";

export interface LifecycleProvider {
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
  if (!Number.isFinite(Date.parse(event.verifiedAt)) ||
      (event.deadline && !Number.isFinite(Date.parse(event.deadline)))) {
    throw new Error("Lifecycle event has an invalid date");
  }
  return event;
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
    verifiedAt: "2026-09-17T19:15:31Z",
    notes: "PreStocks says SpaceX tokens must be swapped into SPCXx or another token before the deadline. No destination mint or executable route has been verified for this event.",
  },
];
const VERIFIED_EVENTS: readonly LifecycleEvent[] = VERIFIED_EVENT_INPUT.map(validateLifecycleEvent);

export class StaticVerifiedLifecycleProvider implements LifecycleProvider {
  async getEvents(): Promise<LifecycleEvent[]> {
    return [...VERIFIED_EVENTS];
  }

  async getEventsForAsset(symbol: string): Promise<LifecycleEvent[]> {
    return VERIFIED_EVENTS.filter((event) => event.assetSymbol === symbol.toUpperCase());
  }

  async getActiveEvents(now = new Date()): Promise<LifecycleEvent[]> {
    return VERIFIED_EVENTS.filter((event) =>
      event.status !== "COMPLETED" && event.status !== "EXPIRED" &&
      (!event.deadline || Date.parse(event.deadline) > now.getTime()),
    );
  }
}

export const lifecycleProvider: LifecycleProvider = new StaticVerifiedLifecycleProvider();
