"use client";

import { useEffect, useState } from "react";

type Result = { id: string; isCurrentHolder: boolean; topCandidate: string; reason: string; updatedAt: string;
  allocations: { candidateId: string; name: string; points: number }[] };

export function ResultView({ id }: { id: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`/api/radar/result/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Result unavailable");
      setResult(body);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Result unavailable"));
  }, [id]);
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { setError("Copy failed. Copy the address from your browser instead."); }
  }
  return <main className="result-page"><header className="radar-header radar-gutter"><a className="brand" href="/">PreStocks <span>/ Radar</span></a><nav aria-label="Main navigation"><a href="/#demand">Demand board</a><a href="/#how">How it works</a><a className="header-connect" href="/#allocate">Build your signal</a></nav></header>
    <section className="result-main radar-gutter"><div className="result-intro"><h1>A signal worth sharing.</h1><p>This link reflects the latest allocation from the wallet that published it.</p></div>
      {error && <p className="radar-error" role="alert">{error}</p>}
      {!result && !error && <p role="status">Loading signal…</p>}
      {result && <div className="result-card"><div className="result-card-top"><span>PreStocks Radar</span><span>100 signal points</span></div><h2>I put {result.topCandidate} first.</h2><div className="result-bars">{result.allocations.map((item) => <div className="result-bar" key={item.candidateId}><strong>{item.name}</strong><div><i style={{ width: `${item.points}%` }} /></div><span>{item.points} points</span></div>)}</div><blockquote>&ldquo;{result.reason}&rdquo;</blockquote><div className="result-status"><strong>{result.isCurrentHolder ? "Current PreStocks holder" : "Community participant"}</strong><span>Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(result.updatedAt))}</span></div><p className="result-caveat">Community demand research. Not governance or a promise of future listing.</p></div>}
      {result && <div className="result-actions"><button className="radar-button" onClick={() => void copy()}>{copied ? "Link copied" : "Copy share link"}</button><a className="radar-text-link" href="/#demand">Explore demand board →</a></div>}
    </section><footer className="radar-footer radar-gutter"><div><strong>PreStocks Radar</strong><p>Wallet verification proves control of an address, not unique-person identity.</p></div><p>Candidate companies are text-only research entries. No future listing is implied.</p></footer></main>;
}
