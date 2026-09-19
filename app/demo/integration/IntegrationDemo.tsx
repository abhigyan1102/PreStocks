"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PreStocksActions } from "../../../components/actionkit";
import styles from "./integration.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type IntegrationMode = "react" | "sdk" | "rest";

const snippets: Record<IntegrationMode, string> = {
  react: `import { PreStocksActions } from "./components/actionkit";

export function WalletActions({ publicKey }: { publicKey: string }) {
  return <PreStocksActions wallet={publicKey} />;
}`,
  sdk: `import { PreStocksActionKit } from "./sdk";

const kit = new PreStocksActionKit();
const result = await kit.wallet.getActions(publicKey);`,
  rest: `GET /api/v1/wallet/:address/actions

// Official holdings + lifecycle state + sourced actions
// Read-only. No wallet signature required.`,
};

export function IntegrationDemo() {
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState("");
  const [wallet, setWallet] = useState("");
  const [mode, setMode] = useState<IntegrationMode>("react");

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.from("[data-hero-item]", {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: "power3.out",
    });

    gsap.timeline({
      scrollTrigger: {
        trigger: "[data-scale-section]",
        start: "top 86%",
        end: "bottom 20%",
        scrub: true,
      },
    })
      .fromTo("[data-scale-media]", { scale: 0.82, opacity: 0.25 }, { scale: 1, opacity: 1, duration: 0.48 })
      .to("[data-scale-media]", { scale: 1.04, opacity: 0.28, duration: 0.52 });

  }, { scope: root });

  function inspectWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWallet(draft.trim());
  }

  return (
    <main className={styles.page} ref={root}>
      <header className={styles.header} data-hero-item>
        <a className={styles.wordmark} href="/#top"><strong>ActionKit</strong><span>/</span>Developer integration</a>
        <nav aria-label="Integration demo navigation">
          <a href="/#top">Main product</a>
          <a href="#difference">Why ActionKit</a>
          <a href="#integrate">Developers</a>
          <a href="#inspect">Inspect wallet</a>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="integration-title">
        <div className={styles.heroCopy}>
          <h1 id="integration-title" data-hero-item>Make any Solana wallet PreStocks-native.</h1>
          <p data-hero-item>Add official asset discovery, live holdings, sourced lifecycle context, and normalized holder actions through one integration.</p>
          <div className={styles.heroActions} data-hero-item>
            <a className={styles.primaryButton} href="#inspect">Inspect a wallet <span aria-hidden="true">↗</span></a>
            <a className={styles.secondaryButton} href="#integrate">Developer quickstart <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <div className={styles.lifecycleArt} aria-hidden="true" data-hero-item>
          <div className={`${styles.orbit} ${styles.orbitOne}`} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={`${styles.artStage} ${styles.privateStage}`}><span>Private exposure</span><i /></div>
          <div className={`${styles.artStage} ${styles.eventStage}`}><span>Company event</span><i><b /><b /><b /></i></div>
          <div className={`${styles.artStage} ${styles.actionStage}`}><span>Holder action</span><i><b /></i></div>
        </div>
      </section>

      <div className={styles.marquee} aria-label="ActionKit capabilities">
        <div>
          <span>Official asset identity</span><i />
          <span>Live wallet balances</span><i />
          <span>Sourced lifecycle events</span><i />
          <span>Normalized holder actions</span><i />
          <span>Official asset identity</span><i />
          <span>Live wallet balances</span><i />
          <span>Sourced lifecycle events</span><i />
          <span>Normalized holder actions</span><i />
        </div>
      </div>

      <section className={styles.comparison} id="difference" data-scale-section aria-labelledby="difference-title">
        <div className={styles.comparisonIntro}>
          <h2 id="difference-title">The same position.<br />A clearer next step.</h2>
          <p>A generic token list stops at ownership. ActionKit adds sourced lifecycle context without inventing an executable route.</p>
        </div>
        <div className={styles.beforePanel}>
          <span className={styles.panelLabel}>Standard SPL wallet</span>
          <h3>A wallet sees a token.</h3>
          <dl>
            <div><dt>Identity</dt><dd>Mint address</dd></div>
            <div><dt>Position</dt><dd>Raw balance</dd></div>
            <div><dt>Next step</dt><dd>Unknown</dd></div>
          </dl>
          <div className={styles.sculpture} data-scale-media><span /></div>
        </div>
        <div className={styles.afterPanel}>
          <span className={styles.panelLabel}>With ActionKit</span>
          <h3>ActionKit sees what happens next.</h3>
          <dl>
            <div><dt>Identity</dt><dd>Official PreStocks mint</dd></div>
            <div><dt>Lifecycle</dt><dd>Reviewed IPO notice</dd></div>
            <div><dt>Holder state</dt><dd>Action required</dd></div>
            <div><dt>Execution</dt><dd>Unavailable until destination and route are verified</dd></div>
            <div><dt>Evidence</dt><dd>Official source URL and verification time</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.integration} id="integrate" aria-labelledby="developer-title">
        <div className={styles.integrationLead}>
          <h2 id="developer-title">One component.<br />The full position context.</h2>
          <p>The React kit calls the typed SDK. The SDK calls the same backend APIs. Lifecycle decisions stay on the server.</p>
          <div className={styles.codeSurface}>
            <div className={styles.integrationModes} role="tablist" aria-label="Integration method">
              {(["react", "sdk", "rest"] as const).map((item) => (
                <button
                  aria-selected={mode === item}
                  className={mode === item ? styles.activeMode : ""}
                  key={item}
                  onClick={() => setMode(item)}
                  role="tab"
                  type="button"
                >{item === "sdk" ? "TypeScript SDK" : item === "rest" ? "REST API" : "React"}</button>
              ))}
            </div>
            <pre><code>{snippets[mode]}</code></pre>
          </div>
        </div>
        <div className={styles.steps}>
          <article>
            <span>01</span>
            <div><h3>Detect official holdings.</h3><p>Match live SPL and Token-2022 accounts against the official PreStocks mint registry.</p></div>
          </article>
          <article>
            <span>02</span>
            <div><h3>Attach sourced events.</h3><p>Preserve the source URL, verification time, deadline, destination facts, and unknown values.</p></div>
          </article>
          <article>
            <span>03</span>
            <div><h3>Return normalized actions.</h3><p>Give the host wallet explicit informational, issuer-managed, manual, route-check, or unavailable states.</p></div>
          </article>
        </div>
      </section>

      <section className={styles.inspector} id="inspect" aria-labelledby="inspector-title">
        <div className={styles.inspectorHeading}>
          <div><h2 id="inspector-title">Inspect a real wallet.</h2><p>Read-only. Solana mainnet. No signature.</p></div>
          <p>Results combine the official PreStocks asset registry with balances read from your configured Solana RPC.</p>
        </div>
        <form className={styles.walletForm} onSubmit={inspectWallet}>
          <label className={styles.srOnly} htmlFor="integration-wallet">Public Solana wallet address</label>
          <input id="integration-wallet" onChange={(event) => setDraft(event.target.value)} placeholder="Enter a public Solana wallet address" spellCheck={false} value={draft} />
          <button disabled={!draft.trim()} type="submit">Inspect wallet <span aria-hidden="true">↗</span></button>
        </form>
        <div className={styles.resultHeader}><span>Source</span><span>Position</span><span>Lifecycle</span><span>Action</span></div>
        <div className={styles.liveResult}>
          {wallet ? <PreStocksActions wallet={wallet} /> : <div className="ak-state"><strong className="ak-state-title">Waiting for a wallet</strong><p className="ak-state-copy">Paste a public address to request live ActionKit actions.</p></div>}
        </div>
      </section>

      <footer className={styles.footer}>
        <div><h2>Make your wallet PreStocks-native.</h2><p>Official positions, sourced events, and honest next actions in one integration.</p></div>
        <a href="#integrate">Start building <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  );
}
