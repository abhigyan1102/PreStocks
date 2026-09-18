import type { GuardianEvaluation, LifecycleEvent, PreStockAsset } from "@/lib/domain";
import { demoHoldings } from "@/lib/demo";
import { evaluateHolding } from "@/lib/guardian";
import { lifecycleProvider } from "@/lib/lifecycle";
import { getPreStocks, premiumPercent } from "@/lib/prestocks";
import { Motion } from "./Motion";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function labelDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  }).format(new Date(value)) + " UTC";
}

function statusForAsset(asset: PreStockAsset, event: LifecycleEvent | undefined): string {
  if (!event) return "No recorded event";
  return event.status === "ACTION_REQUIRED" && event.deadline && Date.parse(event.deadline) > Date.now()
    ? "Action required" : event.status.toLowerCase().replaceAll("_", " ");
}

function AssetRow({ asset, event }: { asset: PreStockAsset; event?: LifecycleEvent }) {
  const premium = premiumPercent(asset);
  return <details className="asset-row">
    <summary>
      <span className="asset-identity">
        {asset.image ? <img src={asset.image} alt="" width="42" height="42" /> : <span className="asset-image-fallback" />}
        <strong>{asset.name.replace(" PreStocks", "")}</strong>
      </span>
      <span className={event?.status === "ACTION_REQUIRED" ? "asset-status action" : "asset-status"}>{statusForAsset(asset, event)}</span>
      <span className="asset-value">{asset.tokenPrice === null ? "Unavailable" : money.format(asset.tokenPrice)}</span>
      <span className="asset-chevron" aria-hidden="true">↗</span>
    </summary>
    <div className="asset-detail">
      <p>Mark price <strong>{asset.markPrice === null ? "Unavailable" : money.format(asset.markPrice)}</strong></p>
      <p>Premium / discount <strong>{premium === null ? "Unavailable" : `${premium >= 0 ? "+" : ""}${premium.toFixed(2)}%`}</strong></p>
      {asset.externalUrl && <a href={asset.externalUrl} target="_blank" rel="noopener noreferrer">View official asset page <span aria-hidden="true">↗</span></a>}
    </div>
  </details>;
}

export default async function Home() {
  let assets: PreStockAsset[] = [];
  let assetError = false;
  try {
    assets = await getPreStocks();
  } catch {
    assetError = true;
  }
  const events = await lifecycleProvider.getEvents();
  const holdings = demoHoldings(assets);
  const evaluations: GuardianEvaluation[] = holdings.map((holding) => {
    const asset = assets.find((candidate) => candidate.mint === holding.mint);
    if (!asset) throw new Error("Demo holding does not map to an official asset");
    return evaluateHolding(asset, holding, events);
  });
  const action = evaluations.find((item) => item.lifecycle.state === "ACTION_REQUIRED");
  const normal = evaluations.filter((item) => item.lifecycle.state === "ACTIVE");
  const displayedAssets = ["SPACEX", "OPENAI", "ANTHROPIC"]
    .map((symbol) => assets.find((asset) => asset.symbol === symbol))
    .filter((asset): asset is PreStockAsset => Boolean(asset));

  return <main className="site-shell">
    <Motion />
    <header className="site-header page-gutter">
      <a className="wordmark" href="#top"><strong>guardian</strong><span>/</span>PreStocks</a>
      <nav aria-label="Main navigation">
        <a href="#top">Overview</a>
        <a href="#action-center">Action center</a>
        <a href="#assets">Assets</a>
        <a href="#developers">Developers</a>
      </nav>
    </header>

    <section className="hero page-gutter" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Know what your holdings need next.</h1>
        <p>Lifecycle events for PreStocks, connected to the tokens a wallet holds.</p>
        <div className="hero-actions">
          <a className="button button-dark" href="#action-center">Explore demo <span aria-hidden="true">↗</span></a>
          <a className="button button-outline" href="#developers">View API <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="stage stage-private"><span className="stage-name">Private exposure</span><span className="stage-disc" /></div>
        <div className="stage stage-event"><span className="stage-name">Company event</span><span className="stage-disc"><i /><i /><i /></span></div>
        <div className="stage stage-action"><span className="stage-name">Holder action</span><span className="stage-disc"><b /></span></div>
      </div>
    </section>

    <section className="action-section page-gutter" id="action-center" aria-labelledby="action-title">
      <div className="section-head"><span>Action center</span><span>Demo environment</span></div>
      <h2 id="action-title">{action ? "One holding needs attention." : "Understand what needs attention."}</h2>
      <div className="demo-intro"><strong>Demo wallet</strong><p>Illustrative token balances. Asset data comes from the official API; events come from a reviewed source snapshot.</p></div>
      {assetError ? <div className="load-error" role="status">Official PreStocks asset data is unavailable. The demo will return when the source is reachable.</div> :
        action ? <div className="action-layout">
          <div className="featured-action">
            <div className="featured-heading">
              {action.asset.image && <img src={action.asset.image} width="54" height="54" alt="" />}
              <strong>{action.asset.name.replace(" PreStocks", "")}</strong>
            </div>
            <div className="featured-columns">
              <div>
                <span className="signal">Action required</span>
                <h3>IPO / token swap</h3>
                <p className="balance"><strong>{action.holding.uiBalance} {action.asset.symbol}</strong> simulated</p>
                <p className="deadline">Deadline {action.lifecycle.event?.deadline ? labelDate(action.lifecycle.event.deadline) : "not provided"}</p>
                <a className="button button-rust" href={action.actions[0]?.url} target="_blank" rel="noopener noreferrer">Read PreStocks instructions <span aria-hidden="true">↗</span></a>
                <p className="source-note">Source: <a href={action.lifecycle.event?.sourceUrl} target="_blank" rel="noopener noreferrer">{action.lifecycle.event?.sourceName}</a> · reviewed {action.lifecycle.event?.verifiedAt ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(action.lifecycle.event.verifiedAt)) : "date unavailable"}</p>
              </div>
              <p className="action-explainer">PreStocks states that SpaceX tokens must be swapped before the deadline. Read its official instructions for options, eligibility, and current details. Guardian does not execute transactions.</p>
            </div>
          </div>
          <aside className="other-holdings"><h3>Other demo holdings</h3>{normal.map((item) => <div key={item.asset.mint} className="other-row"><strong>{item.asset.name.replace(" PreStocks", "")}</strong><span>No recorded event</span></div>)}</aside>
        </div> : <p className="empty-demo">No current action is available in the reviewed snapshot for these demo holdings.</p>}
    </section>

    <section className="assets-section page-gutter" id="assets" aria-labelledby="assets-title">
      <div className="assets-copy">
        <span className="section-kicker">Official assets</span>
        <h2 id="assets-title">Follow the asset.<br />Understand the change.</h2>
        <p>PreStocks market data with lifecycle context beside each token.</p>
        <div className="asset-table-head"><span>Asset</span><span>Status</span><span>Token price</span><span></span></div>
        <div className="asset-list">
          {displayedAssets.map((asset) => <AssetRow key={asset.mint} asset={asset} event={events.find((event) => event.assetMint === asset.mint)} />)}
          {assetError && <p className="load-error">Live asset data is unavailable.</p>}
        </div>
        <a className="text-link" href="https://prestocks.com/products" target="_blank" rel="noopener noreferrer">Explore all official assets <span aria-hidden="true">↗</span></a>
      </div>
      <div className="assets-art" aria-hidden="true"><div className="assets-planet" /><div className="assets-ring ring-one" /><div className="assets-ring ring-two" /></div>
    </section>

    <section className="source-section page-gutter" aria-labelledby="source-title">
      <div className="section-head"><span>Source ledger</span><span>Trace every claim</span></div>
      <h2 id="source-title">A visible trail from event to action.</h2>
      <div className="source-ledger">
        <a className="source-card" href="https://prestocks.com/api/prestocks" target="_blank" rel="noopener noreferrer"><strong>Asset identity</strong><span>PreStocks official API</span><span aria-hidden="true">↗</span></a>
        <a className="source-card" href="https://prestocks.com/spacex" target="_blank" rel="noopener noreferrer"><strong>SpaceX event</strong><span>PreStocks product page</span><span aria-hidden="true">↗</span></a>
        <a className="source-card" href="https://prestocks.com/faq?tab=mechanics" target="_blank" rel="noopener noreferrer"><strong>Lifecycle rules</strong><span>PreStocks FAQ</span><span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="developer-section page-gutter" id="developers" aria-labelledby="developer-title">
      <div className="section-head"><span>For developers</span><span>Read-only API</span></div>
      <h2 className="developer-heading" id="developer-title">{["One", "API", "for", "understanding", "what", "a", "PreStocks", "asset", "needs", "next."].map((word, index) => <span className="reveal-word" key={`${word}-${index}`}>{word} </span>)}</h2>
      <p>Build sourced lifecycle context into a wallet, trading app, or bot.</p>
      <div className="developer-actions"><a className="button button-dark" href="/api/v1/events/SPACEX" target="_blank" rel="noopener noreferrer">View API response <span aria-hidden="true">↗</span></a><a className="button button-outline" href="#action-center">Explore demo <span aria-hidden="true">↗</span></a></div>
      <div className="code-surface"><code><span>GET</span> /api/v1/events/SPACEX</code><pre>{`{\n  "provenance": "reviewed static source snapshot",\n  "events": [{\n    "type": "IPO",\n    "deadline": "2027-03-12T23:59:00Z",\n    "sourceUrl": "https://prestocks.com/spacex"\n  }]\n}`}</pre></div>
    </section>
    <footer className="site-footer page-gutter"><strong>Guardian</strong><span>Official PreStocks assets · reviewed lifecycle source</span></footer>
  </main>;
}
