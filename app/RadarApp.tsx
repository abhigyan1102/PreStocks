"use client";

import { getWallets } from "@wallet-standard/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RadarBoard } from "@/lib/radar/validation";
import { supportsRadar, type SupportedWallet } from "@/lib/radar/wallet-sign-in";
import { RadarMotion } from "./RadarMotion";
import { WalletSignIn } from "./WalletSignIn";

type BoardData = RadarBoard & { reasons: { candidateId: string; reason: string; isCurrentHolder: boolean; updatedAt: string }[] };
type MeData = { authenticated: true; wallet: string; isCurrentPreStocksHolder: boolean; officialPositionCount: number;
  pointsBudget: 100; submission: { id: string; reason: string; allocations: { candidateId: string; points: number }[] } | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body as T;
}
function post<T>(url: string, body: unknown): Promise<T> {
  return api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function shortWallet(wallet: string) { return `${wallet.slice(0, 5)}…${wallet.slice(-5)}`; }
function RadarIllustration() {
  return <div className="radar-illustration" aria-hidden="true"><svg viewBox="0 0 620 620" fill="none">
    <g className="radar-rings" stroke="currentColor" strokeWidth="1"><path d="M310 22v576M22 310h576" />
      {[64, 130, 194, 258].map((r) => <circle key={r} cx="310" cy="310" r={r} />)}
      <circle cx="310" cy="310" r="224" strokeDasharray="2 6" />
    </g>
    <g className="radar-sweep"><path d="M310 310 485 121" stroke="currentColor" strokeWidth="1.5" /><path d="M310 52a258 258 0 0 1 175 69L310 310Z" fill="currentColor" opacity=".035" /></g>
    <circle cx="310" cy="310" r="36" fill="currentColor" /><g stroke="#faf9f6" strokeWidth="1.5"><circle cx="310" cy="310" r="18"/><circle cx="310" cy="310" r="9"/><path d="m310 310 17-17"/></g>
    <g className="radar-nodes" fill="currentColor"><circle cx="187" cy="169" r="6"/><circle cx="473" cy="202" r="6"/><circle cx="148" cy="372" r="6"/><circle cx="519" cy="394" r="6"/><circle cx="397" cy="496" r="6"/></g>
    <g className="radar-labels" fill="#242323"><text x="172" y="157" textAnchor="end">Stripe</text><text x="486" y="191">Canva</text><text x="139" y="398" textAnchor="end">Databricks</text><text x="531" y="383">Discord</text><text x="408" y="519">Ramp</text></g>
  </svg><span className="illustration-caption">Private companies.<br />Public interest.</span></div>;
}

export function RadarApp() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState("");
  const [me, setMe] = useState<MeData | null>(null);
  const [holderError, setHolderError] = useState("");
  const [wallets, setWallets] = useState<SupportedWallet[]>([]);
  const [chooseWallet, setChooseWallet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [segment, setSegment] = useState<"all" | "holders">("all");
  const [shareHref, setShareHref] = useState("");
  const [copied, setCopied] = useState(false);
  const [reasonIndex, setReasonIndex] = useState(0);
  const draftDirty = useRef(false);

  const loadBoard = useCallback(async () => {
    try { setBoard(await api<BoardData>("/api/radar/board")); setBoardError(""); }
    catch (caught) { setBoardError(caught instanceof Error ? caught.message : "Demand board unavailable"); }
  }, []);
  const loadMe = useCallback(async () => {
    try {
      const next = await api<MeData | { authenticated: false }>("/api/radar/me");
      if (next.authenticated) {
        setMe(next);
        if (!draftDirty.current) {
          setReason(next.submission?.reason ?? "");
          setPoints(Object.fromEntries(next.submission?.allocations.map((item) => [item.candidateId, item.points]) ?? []));
        }
      } else setMe(null);
      setHolderError("");
    } catch (caught) { setHolderError(caught instanceof Error ? caught.message : "Holder check unavailable"); }
  }, []);
  useEffect(() => {
    void loadBoard(); void loadMe();
    const registry = getWallets();
    const refresh = () => setWallets(registry.get().filter(supportsRadar));
    refresh();
    const offRegister = registry.on("register", refresh);
    const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, [loadBoard, loadMe]);

  const total = Object.values(points).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const remaining = 100 - total;
  const candidates = useMemo(() => [...(board?.candidates ?? [])].sort((a, b) => a.displayOrder - b.displayOrder), [board]);
  const ranked = useMemo(() => [...candidates].sort((a, b) => (segment === "holders" ? b.holderPoints - a.holderPoints : b.totalPoints - a.totalPoints) || a.displayOrder - b.displayOrder), [candidates, segment]);
  const top = [...candidates].filter((item) => (points[item.id] ?? 0) > 0).sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0) || a.displayOrder - b.displayOrder)[0];
  const totalSignal = candidates.reduce((sum, item) => sum + (segment === "holders" ? item.holderPoints : item.totalPoints), 0);
  const allReasons = (board?.reasons ?? []).filter((item) => segment === "all" || item.isCurrentHolder);
  const currentReason = allReasons.length ? allReasons[reasonIndex % allReasons.length] : null;

  function updatePoints(candidateId: string, value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100) return;
    draftDirty.current = true;
    setPoints((current) => ({ ...current, [candidateId]: value })); setShareHref("");
  }
  function askToConnect() { setError(""); setChooseWallet(true); }
  async function signOut() {
    setBusy(true);
    try { await post("/api/radar/logout", {}); setMe(null); draftDirty.current = false; setPoints({}); setReason(""); setShareHref(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not sign out"); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!me || total !== 100 || !reason.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await post<{ href: string }>("/api/radar/submit", {
        allocations: candidates.map((candidate) => ({ candidateId: candidate.id, points: points[candidate.id] ?? 0 })), reason,
      });
      setShareHref(result.href); setCopied(false); draftDirty.current = false;
      await Promise.all([loadBoard(), loadMe()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Signal could not be published"); }
    finally { setBusy(false); }
  }
  async function copyShare() {
    if (!shareHref) return;
    try { await navigator.clipboard.writeText(new URL(shareHref, window.location.origin).toString()); setCopied(true); }
    catch { setError("Copy failed. Open your result and copy the address from the browser."); }
  }

  return <main className="radar-shell" id="top">
    <RadarMotion />
    <a className="skip-link" href="#demand">Skip to demand board</a>
    <header className="radar-header radar-gutter"><a className="brand" href="#top">PreStocks <span>/ Radar</span></a><nav aria-label="Main navigation"><a href="#demand">Demand board</a><a href="#how">How it works</a><button className="header-connect" onClick={me ? () => void signOut() : askToConnect} disabled={busy}>{me ? `${shortWallet(me.wallet)} · Sign out` : "Connect wallet"}</button></nav></header>

    <section className="radar-hero radar-gutter" aria-labelledby="radar-title"><div className="radar-hero-copy">
      <p className="hero-kicker">The next chapter starts with your signal.</p>
      <h1 id="radar-title"><span>Put the next</span><span>name on</span><span>the radar<span className="accent">.</span></span></h1>
      <p>Tell PreStocks which private companies you want access to. Allocate 100 points. Publish your perspective.</p>
      <div className="radar-hero-actions"><a className="radar-button" href="#allocate">Build your signal <span aria-hidden="true">→</span></a><a className="radar-text-link" href="#demand">Explore demand</a></div>
    </div><RadarIllustration /></section>

    {candidates.length > 0 && <div className="candidate-ticker"><span className="ticker-label">Candidate companies</span><div className="ticker-window"><div className="ticker-track">{[0, 1].map((copy) => <div key={copy} aria-hidden={copy === 1 ? true : undefined}>{candidates.map((candidate) => <span key={candidate.id}>{candidate.name}</span>)}</div>)}</div></div></div>}

    <section className="demand-section radar-gutter" id="demand" aria-labelledby="demand-title">
      <div className="section-intro"><div><h2 id="demand-title">A clearer picture of demand.</h2><p>See which private companies the community wants PreStocks to tokenize next.</p></div><div className="demand-total"><strong>{board ? board.metrics.currentSubmissions.toLocaleString() : "—"}</strong><span>published signals</span></div></div>
      {boardError && <p className="radar-error" role="alert">{boardError} <button onClick={() => void loadBoard()}>Retry</button></p>}
      {!board && !boardError && <p className="loading-state" role="status">Loading the demand board…</p>}
      {board && <>
        <div className="segment-row"><div className="segment-tabs" role="group" aria-label="Demand segment"><button aria-pressed={segment === "all"} onClick={() => setSegment("all")}>All community</button><button aria-pressed={segment === "holders"} onClick={() => setSegment("holders")}>Current holders</button></div><p>Equal 100 points per wallet.</p></div>
        <table className="demand-table"><caption className="sr-only">{segment === "holders" ? "Current PreStocks holder demand" : "All community demand"}, ranked by signal points</caption><thead><tr><th scope="col">Company</th><th scope="col">Points <span aria-hidden="true">↓</span></th><th scope="col">Share</th><th scope="col">Wallets</th></tr></thead><tbody>{ranked.map((candidate) => {
          const signal = segment === "holders" ? candidate.holderPoints : candidate.totalPoints;
          const count = segment === "holders" ? candidate.holderWallets : candidate.allocatingWallets;
          const percentage = totalSignal ? signal * 100 / totalSignal : 0;
          return <tr key={candidate.id}><th scope="row"><div className="company-cell"><span className="company-initial" aria-hidden="true">{candidate.name[0]}</span><div><strong>{candidate.name}</strong><small>{candidate.description}</small></div></div></th><td>{signal.toLocaleString()}</td><td>{percentage.toFixed(1)}%</td><td>{count.toLocaleString()}</td></tr>;
        })}</tbody></table>
        {totalSignal === 0 && <div className="board-empty"><p>{segment === "holders" ? "No holder signals yet." : "No signals yet. Yours can start the conversation."}</p><a className="radar-text-link" href="#allocate">Build your signal <span aria-hidden="true">→</span></a></div>}
        <div className="board-footnote"><span>{board.metrics.currentHolderParticipants} current holders · {board.metrics.signedParticipants} signed participants</span><span>{board.metrics.latestUpdate ? `Updated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(board.metrics.latestUpdate))}` : "Waiting for the first published signal"}</span></div>
        {currentReason && <div className="reason-carousel"><div><span className="subtle-label">Behind the signal</span><blockquote>“{currentReason.reason}”</blockquote><p>{candidates.find((candidate) => candidate.id === currentReason.candidateId)?.name} · {currentReason.isCurrentHolder ? "Current holder" : "Community participant"}</p></div><div className="carousel-controls"><button className="icon-button" aria-label="Previous reason" onClick={() => setReasonIndex((index) => (index - 1 + allReasons.length) % allReasons.length)}>←</button><button className="icon-button" aria-label="Next reason" onClick={() => setReasonIndex((index) => index + 1)}>→</button></div></div>}
      </>}
    </section>

    <section className="allocation-section radar-gutter" id="allocate" aria-labelledby="allocation-title">
      <div className="allocation-layout"><div className="allocation-intro" id="how"><h2 id="allocation-title">Make your <br />100 points <br />count<span className="accent">.</span></h2><p className="allocation-lede">A little weight behind the companies you want to see next.</p>
        <ol className="how-steps"><li><strong>Draft</strong><p>Divide 100 whole points across the candidates. Tell us why your top pick matters.</p></li><li><strong>Sign in</strong><p>Connect a Solana wallet, then approve a sign-in message. No transaction required.</p></li><li><strong>Publish</strong><p>Add your signal to the board. You can change it later; your latest allocation replaces the previous one.</p></li></ol>
        <div className={`remaining ${remaining < 0 ? "over-budget" : ""}`} role="status"><strong>{remaining}</strong><span>points remaining</span><div className="budget-track"><i style={{ width: `${Math.min(total, 100)}%` }} /></div></div>
      </div>
      <div className="allocation-grid"><div className="allocation-column-heading"><span>Company</span><span>Your points</span></div>{!board && <p className="loading-state">{boardError ? "Load the demand board to see candidates." : "Loading candidates…"}</p>}{candidates.map((candidate) => <div className="allocation-row" key={candidate.id}><label htmlFor={`points-${candidate.id}`}>{candidate.name}</label><div className="point-controls"><button type="button" disabled={busy || !(points[candidate.id] ?? 0)} aria-label={`Remove 10 points from ${candidate.name}`} onClick={() => updatePoints(candidate.id, Math.max(0, (points[candidate.id] ?? 0) - 10))}>−</button><input id={`points-${candidate.id}`} disabled={busy} type="number" inputMode="numeric" min="0" max="100" step="1" aria-label={`${candidate.name} signal points`} value={points[candidate.id] ?? 0} onChange={(event) => updatePoints(candidate.id, Number(event.target.value))} /><button type="button" disabled={busy || remaining <= 0} aria-label={`Add 10 points to ${candidate.name}`} onClick={() => updatePoints(candidate.id, Math.min(100, (points[candidate.id] ?? 0) + Math.min(10, Math.max(0, remaining))))}>+</button></div></div>)}</div>
      <div className="publish-panel"><h3>Your perspective.</h3><p>Give your top pick a little context. Your reason will be public alongside your signal.</p>
        {me && <div className="wallet-status"><strong>{me.isCurrentPreStocksHolder ? "Current PreStocks holder" : "Community participant"}</strong><span>{shortWallet(me.wallet)}</span></div>}
        <div className="reason-field"><label htmlFor="radar-reason">Why {top?.name ?? "your top pick"}?</label><textarea id="radar-reason" required disabled={busy} maxLength={220} rows={5} placeholder="One short sentence about why this company matters to you." value={reason} onChange={(event) => { draftDirty.current = true; setReason(event.target.value); setShareHref(""); }} /><span className="reason-count">{reason.length} / 220</span></div>
        {holderError && <p className="radar-error" role="alert">{holderError} <button onClick={() => void loadMe()}>Retry session check</button></p>}
        {error && <p className="radar-error" role="alert">{error}</p>}
        <button className="radar-button publish-button" onClick={me ? () => void publish() : askToConnect} disabled={busy || (Boolean(me) && (total !== 100 || !reason.trim()))}>{busy ? "Please wait…" : !me ? "Connect to publish" : me.submission ? "Update signal" : "Publish signal"}<span aria-hidden="true">→</span></button>
        <p className="allocation-help" role="status">{!me ? "Draft first. Sign in when you are ready." : remaining > 0 ? `Allocate ${remaining} more points to publish.` : remaining < 0 ? `Remove ${Math.abs(remaining)} points to publish.` : !reason.trim() ? "Add a reason for your top pick." : "Ready to publish your 100-point signal."}</p>
        {shareHref && <div className="publish-success" role="status"><strong>Your signal is live.</strong><a href={shareHref}>View your shareable result ↗</a><button onClick={() => void copyShare()}>{copied ? "Link copied" : "Copy share link"}</button></div>}
      </div></div>
      <div className="allocation-footnote"><p>Exactly 100 points per wallet. Holder status does not add points.</p><p>Holdings are checked against official PreStocks mints when you publish.</p></div>
    </section>

    <footer className="radar-footer radar-gutter"><div><a className="brand" href="#top">PreStocks <span>/ Radar</span></a><p>Community demand, made visible.</p></div><div><p>Research candidates are not endorsed listings. Signals are not governance or a promise of future listing.</p><p>Wallet verification proves address control, not unique-person identity.</p></div><a className="back-top" href="#top">Back to top ↑</a></footer>
    {chooseWallet && <WalletSignIn wallets={wallets} onClose={() => setChooseWallet(false)} onSignedIn={loadMe} />}
  </main>;
}
