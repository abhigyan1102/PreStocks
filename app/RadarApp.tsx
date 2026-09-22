"use client";

import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RadarBoard, RadarCandidate } from "@/lib/radar/validation";
import { RadarMotion } from "./RadarMotion";

type BoardData = RadarBoard & { reasons: { candidateId: string; reason: string; isCurrentHolder: boolean; updatedAt: string }[] };
type MeData = { authenticated: true; wallet: string; isCurrentPreStocksHolder: boolean; officialPositionCount: number;
  pointsBudget: 100; submission: { id: string; reason: string; allocations: { candidateId: string; points: number }[] } | null };
type SupportedWallet = Wallet & StandardConnectFeature & SolanaSignMessageFeature;

function supportsSignal(wallet: Wallet): wallet is SupportedWallet {
  return typeof (wallet.features[StandardConnect] as { connect?: unknown } | undefined)?.connect === "function" &&
    typeof (wallet.features[SolanaSignMessage] as { signMessage?: unknown } | undefined)?.signMessage === "function";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function shortWallet(wallet: string): string { return `${wallet.slice(0, 5)}…${wallet.slice(-5)}`; }
function labelTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No updates yet";
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
  const [reasonIndex, setReasonIndex] = useState(0);

  const loadBoard = useCallback(async () => {
    try { setBoard(await api<BoardData>("/api/radar/board")); setBoardError(""); }
    catch (caught) { setBoardError(caught instanceof Error ? caught.message : "Demand board unavailable"); }
  }, []);
  const loadMe = useCallback(async () => {
    try {
      const next = await api<MeData | { authenticated: false }>("/api/radar/me");
      if (next.authenticated) {
        setMe(next);
        setReason(next.submission?.reason ?? "");
        setPoints(Object.fromEntries(next.submission?.allocations.map((item) => [item.candidateId, item.points]) ?? []));
      } else setMe(null);
      setHolderError("");
    } catch (caught) { setHolderError(caught instanceof Error ? caught.message : "Holder check unavailable"); }
  }, []);

  useEffect(() => {
    void loadBoard(); void loadMe();
    const registry = getWallets();
    const refresh = () => setWallets(registry.get().filter(supportsSignal));
    refresh();
    const offRegister = registry.on("register", refresh);
    const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, [loadBoard, loadMe]);

  const total = Object.values(points).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const remaining = 100 - total;
  const candidates = useMemo(() => [...(board?.candidates ?? [])].sort((a, b) => a.displayOrder - b.displayOrder), [board]);
  const top = useMemo(() => candidates.filter((item) => (points[item.id] ?? 0) > 0)
    .sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0) || a.displayOrder - b.displayOrder)[0], [candidates, points]);
  const totalSignal = board?.candidates.reduce((sum, item) => sum + (segment === "holders" ? item.holderPoints : item.totalPoints), 0) ?? 0;
  const allReasons = board?.reasons ?? [];

  function updatePoints(candidateId: string, value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100) return;
    setPoints((current) => ({ ...current, [candidateId]: value }));
    setShareHref("");
  }

  function askToConnect() {
    setError("");
    if (wallets.length === 0) { setError("No compatible Solana wallet found. Install a wallet that supports message signing, then refresh."); return; }
    setChooseWallet(true);
    document.getElementById("connect")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function connect(wallet: SupportedWallet) {
    setBusy(true); setError(""); setChooseWallet(false);
    try {
      const connector = wallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect];
      const signer = wallet.features[SolanaSignMessage] as SolanaSignMessageFeature[typeof SolanaSignMessage];
      const connected = await connector.connect();
      const account: WalletAccount | undefined = connected.accounts.find((item: WalletAccount) =>
        item.chains.some((chain: string) => chain.startsWith("solana:")) && item.features.includes(SolanaSignMessage));
      if (!account) throw new Error("This wallet does not offer a Solana account that can sign messages.");
      const challenge = await post<{ challengeId: string; message: string }>("/api/radar/challenge", { wallet: account.address });
      const signed = await signer.signMessage({ account, message: new TextEncoder().encode(challenge.message) });
      const output = signed[0];
      if (!output) throw new Error("The wallet did not return a signature.");
      const signedMessage = new TextDecoder().decode(output.signedMessage);
      const signature = btoa(String.fromCharCode(...output.signature));
      await post("/api/radar/verify", { challengeId: challenge.challengeId, wallet: account.address, signature, signedMessage });
      await loadMe();
      document.getElementById("allocate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Wallet verification failed"); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    try { await post("/api/radar/logout", {}); setMe(null); setPoints({}); setReason(""); setShareHref(""); }
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
      setShareHref(result.href);
      await Promise.all([loadBoard(), loadMe()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Signal could not be published"); }
    finally { setBusy(false); }
  }

  async function copyShare() {
    if (!shareHref) return;
    try { await navigator.clipboard.writeText(new URL(shareHref, window.location.origin).toString()); }
    catch { setError("Copy failed. Open your result and copy the address from the browser."); }
  }

  return <main className="radar-shell" id="top">
    <RadarMotion />
    <header className="radar-header radar-gutter">
      <a href="#top" className="radar-wordmark">PreStocks <span>Radar</span></a>
      <nav aria-label="Main navigation"><a href="#demand">Demand board</a><a href="#how">How it works</a><a href="#allocate">Your signal</a></nav>
      <button className="header-connect" onClick={me ? () => void signOut() : askToConnect} disabled={busy}>
        {me ? `${shortWallet(me.wallet)} · Sign out` : "Connect wallet"}
      </button>
    </header>

    <section className="radar-hero radar-gutter" aria-labelledby="radar-title">
      <div className="radar-hero-copy">
        <h1 id="radar-title">What should PreStocks tokenize next?</h1>
        <p>Allocate 100 signal points across private companies and see what the PreStocks community wants access to next.</p>
        <div className="radar-hero-actions"><button className="radar-button dark" onClick={me ? () => document.getElementById("allocate")?.scrollIntoView({ behavior: "smooth" }) : askToConnect}>{me ? "Shape your signal" : "Connect wallet"}<span aria-hidden="true">↗</span></button><a href="#demand" className="radar-text-link">Explore demand <span aria-hidden="true">↗</span></a></div>
      </div>
      <div className="radar-hero-art" aria-hidden="true"><div className="signal-squares">{Array.from({ length: 100 }, (_, index) => <i key={index} />)}</div><div className="signal-stream"><i /><i /><i /><i /><i /></div><div className="signal-columns"><i /><i /><i /><i /><i /></div></div>
    </section>

    <div className="candidate-ticker" aria-label="Curated candidate companies"><div>{[...candidates, ...candidates].map((candidate, index) => <span key={`${candidate.id}-${index}`}>{candidate.name}</span>)}</div></div>

    <section className="demand-section radar-gutter" id="demand" aria-labelledby="demand-title">
      <div className="section-intro"><div><p className="eyebrow">Public demand board</p><h2 id="demand-title">Where community interest is going.</h2><p>Every published allocation is counted from persistent submissions. The board is public to explore.</p></div><div className="demand-total"><strong>{board?.metrics.signedParticipants ?? 0}</strong><span>signed participants</span></div></div>
      {boardError && <p className="radar-error" role="alert">{boardError} <button onClick={() => void loadBoard()}>Retry</button></p>}
      {board && <>
        <div className="segment-row"><div className="segment-tabs" role="tablist" aria-label="Demand segment"><button role="tab" aria-selected={segment === "all"} className={segment === "all" ? "active" : ""} onClick={() => setSegment("all")}>All community</button><button role="tab" aria-selected={segment === "holders"} className={segment === "holders" ? "active" : ""} onClick={() => setSegment("holders")}>Current PreStocks holders</button></div><p>Equal 100 points per wallet. Holder status is checked when a signal is published.</p></div>
        <div className="board-layout"><div className="board-list"><div className="board-head"><span>Company</span><span>Points</span><span>Share</span><span>Wallets</span></div>{board.candidates.map((candidate, index) => {
          const signal = segment === "holders" ? candidate.holderPoints : candidate.totalPoints;
          const walletsCount = segment === "holders" ? candidate.holderWallets : candidate.allocatingWallets;
          const percentage = totalSignal ? signal * 100 / totalSignal : 0;
          const reasons = board.reasons.filter((item) => item.candidateId === candidate.id).slice(0, 2);
          return <div className="board-row" key={candidate.id}><div className="board-row-main"><div className="board-name"><span className="rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{candidate.name}</strong><small>{candidate.description}</small></div></div><strong>{signal.toLocaleString()}</strong><span>{percentage.toFixed(1)}%</span><span>{walletsCount}</span></div><div className="board-track"><i style={{ width: `${percentage}%` }} /></div><div className="board-split"><span>Holder signal {candidate.holderPoints.toLocaleString()} · {candidate.holderWallets} wallets</span><span>Community signal {candidate.communityPoints.toLocaleString()} · {candidate.communityWallets} wallets</span></div>{reasons.length > 0 && <div className="board-reasons">{reasons.map((item, position) => <p key={`${item.updatedAt}-${position}`}>&ldquo;{item.reason}&rdquo; <span>{item.isCurrentHolder ? "Current holder" : "Community participant"}</span></p>)}</div>}</div>;
        })}</div><aside className="board-aside"><div className="aside-rule" /><h3>{board.metrics.signedParticipants === 0 ? "Be the first to share your signal." : "The picture changes with every signal."}</h3><p>{board.metrics.signedParticipants === 0 ? "Connect a Solana wallet, put your 100 points where your interest is, and publish your view." : "These are current allocations from wallet-controlled addresses. Each wallet has one current submission."}</p><button className="radar-button rust" onClick={me ? () => document.getElementById("allocate")?.scrollIntoView({ behavior: "smooth" }) : askToConnect}>{me ? "Edit your allocation" : "Connect wallet"}<span aria-hidden="true">↗</span></button><p className="aside-note">Wallet verification proves control of an address, not unique-person identity.</p></aside></div>
        <div className="metric-strip"><div><strong>{board.metrics.signedParticipants}</strong><span>Signed participants</span></div><div><strong>{board.metrics.currentHolderParticipants}</strong><span>Current holders</span></div><div><strong>{board.metrics.currentSubmissions}</strong><span>Current submissions</span></div><div><strong>{labelTime(board.metrics.latestUpdate)}</strong><span>Latest update</span></div></div>
        {allReasons.length > 0 && <div className="reason-carousel" aria-label="Recent reasons"><div><p className="eyebrow">What people are saying</p><blockquote>&ldquo;{allReasons[reasonIndex % allReasons.length].reason}&rdquo;</blockquote><span>{candidates.find((candidate) => candidate.id === allReasons[reasonIndex % allReasons.length].candidateId)?.name ?? "Candidate"} · {allReasons[reasonIndex % allReasons.length].isCurrentHolder ? "Current holder" : "Community participant"}</span></div><div className="carousel-controls"><button aria-label="Previous reason" onClick={() => setReasonIndex((index) => (index - 1 + allReasons.length) % allReasons.length)}>←</button><button aria-label="Next reason" onClick={() => setReasonIndex((index) => (index + 1) % allReasons.length)}>→</button></div></div>}
      </>}
    </section>

    <section className="how-section radar-gutter" id="how" aria-labelledby="how-title"><div className="how-intro"><h2 id="how-title">{["One", "address.", "One", "current", "signal."].map((word, index) => <span className="how-word" key={`${word}-${index}`}>{word} </span>)}</h2><p>Radar measures expressed interest, not a listing decision. Your signature proves wallet control; official PreStocks holdings only change the segment shown beside your signal.</p></div><div className="how-grid"><div className="how-card"><strong>Connect and sign</strong><p>Approve a short wallet message. No transaction or private key is requested.</p></div><div className="how-card"><strong>Check current holdings</strong><p>Official PreStocks mints are read from Solana. Holders and non-holders have the same 100 points.</p></div><div className="how-card"><strong>Allocate exactly 100</strong><p>Spread whole points across curated company candidates and explain your top pick.</p></div><div className="how-card"><strong>Publish and explore</strong><p>Your latest allocation replaces the earlier one. The aggregate board updates from real submissions.</p></div></div></section>

    <section className="allocation-section radar-gutter" id="allocate" aria-labelledby="allocation-title"><div id="connect" className="allocation-heading"><div><p className="eyebrow">Your allocation</p><h2 id="allocation-title">You have 100 signal points.</h2><p>Distribute them across the companies you want to see next.</p></div><div className="remaining"><strong>{remaining}<span> / 100</span></strong><small>remaining</small></div></div>
      {me && <div className="wallet-status"><span className="status-dot" />{me.isCurrentPreStocksHolder ? "Current PreStocks holder" : "Community participant"}<small>{shortWallet(me.wallet)}</small></div>}
      {holderError && <p className="radar-error" role="alert">{holderError} <button onClick={() => void loadMe()}>Retry holder check</button></p>}
      {error && <p className="radar-error" role="alert">{error}</p>}
      {chooseWallet && <div className="wallet-picker" role="dialog" aria-label="Choose a wallet"><h3>Choose a Solana wallet</h3><div>{wallets.map((wallet) => <button key={wallet.name} onClick={() => void connect(wallet)} disabled={busy}>{wallet.name}</button>)}</div><button className="picker-close" onClick={() => setChooseWallet(false)}>Cancel</button></div>}
      {!me ? <div className="locked-allocation"><p>Connect and sign to allocate. You can explore the demand board without a wallet.</p><button className="radar-button dark" onClick={askToConnect} disabled={busy}>Connect wallet <span aria-hidden="true">↗</span></button></div> : <><div className="allocation-grid">{candidates.map((candidate) => <div className="allocation-row" key={candidate.id}><div><strong>{candidate.name}</strong><p>{candidate.description}</p></div><div className="point-controls"><button type="button" aria-label={`Remove 10 points from ${candidate.name}`} onClick={() => updatePoints(candidate.id, Math.max(0, (points[candidate.id] ?? 0) - 10))}>−</button><input type="number" inputMode="numeric" min="0" max="100" step="1" aria-label={`${candidate.name} signal points`} value={points[candidate.id] ?? 0} onChange={(event) => { const value = Number(event.target.value); if (event.target.value === "") updatePoints(candidate.id, 0); else updatePoints(candidate.id, value); }} /><button type="button" aria-label={`Add 10 points to ${candidate.name}`} onClick={() => updatePoints(candidate.id, Math.min(100, (points[candidate.id] ?? 0) + Math.min(10, Math.max(0, remaining))))}>+</button></div></div>)}</div><div className="reason-field"><div><label htmlFor="radar-reason">Why is {top?.name ?? "your top pick"} your top pick?</label><span>{reason.length} / 220</span></div><textarea id="radar-reason" maxLength={220} rows={3} placeholder="One short sentence about why this company matters to you." value={reason} onChange={(event) => { setReason(event.target.value); setShareHref(""); }} /></div><div className="publish-row"><button className="radar-button rust" onClick={() => void publish()} disabled={busy || total !== 100 || !reason.trim()}>{busy ? "Publishing…" : me.submission ? "Update signal" : "Publish signal"}<span aria-hidden="true">↗</span></button><p>Exactly 100 whole points. Holder status does not add points.</p></div>{total !== 100 && <p className="allocation-help" role="status">{remaining > 0 ? `Allocate ${remaining} more points to publish.` : `Remove ${Math.abs(remaining)} points to publish.`}</p>}{shareHref && <div className="publish-success" role="status"><strong>Your signal is live.</strong><p>The public board has been refreshed. Your result link always shows your current allocation.</p><div><a href={shareHref}>View shareable result ↗</a><button onClick={() => void copyShare()}>Copy share link</button></div></div>}</>}
    </section>

    <footer className="radar-footer radar-gutter"><div><strong>PreStocks Radar</strong><p>Community demand research. Not governance or a promise of future listing.</p></div><p>Candidates are independent research entries, not endorsed listings. Wallet verification proves address control, not unique identity.</p></footer>
  </main>;
}
