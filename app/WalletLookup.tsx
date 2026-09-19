"use client";

import { useState, type FormEvent } from "react";
import type { PositionAction, ResolutionPlan } from "@/lib/domain";

interface WalletResult {
  mode: "live";
  wallet: string;
  positions: Array<{
    symbol: string;
    name: string;
    mint: string;
    balance: string;
    rawBalance: string;
    decimals: number;
    status: string;
    actions: PositionAction[];
  }>;
  summary: { prestocksPositions: number; positionsRequiringAction: number };
}

export function WalletLookup() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<WalletResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{ symbol: string; resolution: ResolutionPlan } | null>(null);
  const [planError, setPlanError] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [routeStatus, setRouteStatus] = useState("");

  async function checkWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setPlan(null);
    setPlanError("");
    setRouteStatus("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/wallet/${encodeURIComponent(address.trim())}/actions`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Wallet lookup failed");
      setResult(payload as WalletResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function checkPlan(symbol: string) {
    if (!result) return;
    setPlan(null);
    setPlanError("");
    setRouteStatus("");
    setPlanLoading(true);
    try {
      const response = await fetch("/api/v1/resolve/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: result.wallet, symbol }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Resolution plan unavailable");
      setPlan({ symbol, resolution: payload.resolution as ResolutionPlan });
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "Resolution plan unavailable");
    } finally { setPlanLoading(false); }
  }

  async function checkRoute(symbol: string) {
    if (!result) return;
    setPlanLoading(true);
    setPlanError("");
    try {
      const response = await fetch("/api/v1/resolve/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: result.wallet, symbol }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Route check unavailable");
      setRouteStatus(payload.status === "EXECUTABLE" ? "A live Jupiter route was verified. Transaction signing is not enabled in this release." : "No executable route is available. Follow the official instructions.");
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "Route check unavailable");
    } finally { setPlanLoading(false); }
  }

  return <section className="wallet-lookup page-gutter" id="wallet-lookup" aria-labelledby="wallet-title">
    <div className="section-head"><span>Live wallet</span><span>Read-only Solana lookup</span></div>
    <h2 id="wallet-title">Check your public wallet.</h2>
    <p>Paste a public Solana address. ActionKit matches token accounts against the official PreStocks mint registry and returns normalized position actions. No connection or signature is needed.</p>
    <form onSubmit={checkWallet} className="wallet-form">
      <label htmlFor="wallet-address">Public Solana wallet address</label>
      <div><input id="wallet-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter Solana wallet address" autoComplete="off" spellCheck={false} required /><button className="button button-dark" disabled={loading}>{loading ? "Checking…" : "Check wallet"}</button></div>
    </form>
    {error && <p className="wallet-feedback" role="alert">{error}</p>}
    {result && <div className="wallet-results" aria-live="polite">
      <div className="wallet-results-head"><strong>LIVE WALLET</strong><span>{result.wallet}</span></div>
      <p>PreStocks positions: <strong>{result.summary.prestocksPositions}</strong> · Positions requiring action: <strong>{result.summary.positionsRequiringAction}</strong></p>
      {result.positions.length === 0 ? <p>No PreStocks balances were detected in this wallet.</p> : result.positions.map((item) => <article key={item.mint} className="wallet-result-row">
        <div><h3>{item.name.replace(" PreStocks", "")}</h3><p>{item.balance} {item.symbol}</p></div>
        <div><strong className={item.status === "ACTION_REQUIRED" ? "wallet-action-state" : ""}>{item.status === "ACTIVE" ? "Standard actions available" : item.status.replaceAll("_", " ")}</strong>
          {item.status === "ACTION_REQUIRED" && <button type="button" className="wallet-plan-button" onClick={() => checkPlan(item.symbol)} disabled={planLoading}>{planLoading ? "Checking…" : "See next step"}</button>}
        </div>
        {plan?.symbol === item.symbol && <div className="wallet-plan">
          <span>RESOLUTION PLAN · {plan.resolution.status.replaceAll("_", " ")}</span>
          <p>{plan.resolution.status === "MANUAL_ACTION_REQUIRED" ? "The event is sourced, but no destination mint or executable route is verified. Follow the issuer's instructions." : plan.resolution.status === "ROUTE_CHECK_REQUIRED" ? "A destination is recorded. Check whether a live route exists before treating it as executable." : "Review the current sourced position state."}</p>
          {plan.resolution.officialInstructionsUrl && <a href={plan.resolution.officialInstructionsUrl} target="_blank" rel="noopener noreferrer">Read official instructions ↗</a>}
          {plan.resolution.status === "ROUTE_CHECK_REQUIRED" && <button type="button" className="wallet-plan-button" onClick={() => checkRoute(item.symbol)} disabled={planLoading}>Check live route</button>}
          {routeStatus && <p role="status">{routeStatus}</p>}
        </div>}
      </article>)}
      {planError && <p className="wallet-feedback" role="alert">{planError}</p>}
      <p className="wallet-caveat">Lifecycle coverage comes from reviewed source snapshots. “No recorded event” does not mean no corporate action exists. Check official instructions before acting.</p>
    </div>}
  </section>;
}
