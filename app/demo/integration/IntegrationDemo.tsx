"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PreStocksActions } from "../../../components/actionkit";
import styles from "./integration.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const code = `import { PreStocksActionKit } from "./sdk";

const kit = new PreStocksActionKit();
const result = await kit.wallet.getActions(wallet);`;

const reactCode = `import { PreStocksActions } from "./components/actionkit";

<PreStocksActions wallet={publicKey} />`;

export function IntegrationDemo() {
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState("");
  const [wallet, setWallet] = useState("");

  useGSAP(() => {
    gsap.from("[data-hero]", { y: 28, opacity: 0, duration: 0.75, stagger: 0.09, ease: "power3.out" });
    gsap.from("[data-scrub-word]", {
      opacity: 0.12,
      stagger: 0.08,
      scrollTrigger: { trigger: "[data-scrub]", start: "top 82%", end: "bottom 54%", scrub: true },
    });
    gsap.from("[data-stack]", {
      y: 72,
      opacity: 0.25,
      stagger: 0.16,
      scrollTrigger: { trigger: "[data-stack-wrap]", start: "top 78%", end: "center 55%", scrub: 0.7 },
    });
  }, { scope: root });

  return (
    <main className={styles.page} ref={root}>
      <nav className={styles.nav} data-hero>
        <a className={styles.brand} href="/">PreStocks <span>ActionKit</span></a>
        <div className={styles.navLinks}><a href="#difference">Before / after</a><a href="#integrate">Integrate</a><a href="#inspect">Inspect</a></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 data-hero>Give any Solana wallet lifecycle awareness.</h1>
          <p data-hero>ActionKit turns verified PreStocks balances, reviewed lifecycle notices, and explicit action states into one read-only interface.</p>
          <a className={styles.primary} data-hero href="#inspect">Inspect a wallet <span aria-hidden>→</span></a>
        </div>
        <div className={styles.heroProof} data-hero>
          <div className={styles.flowLabel}><span>Wallet position</span><span>ActionKit context</span></div>
          <div className={styles.flowRow}><div><strong>SPACEX</strong><small>balance + mint</small></div><span aria-hidden>→</span><div className={styles.signal}><strong>Review required</strong><small>Sourced lifecycle notice</small></div></div>
          <p>ActionKit never marks an action executable without a verified destination and a matching live route.</p>
        </div>
      </section>

      <section className={styles.comparison} id="difference" data-stack-wrap>
        <div className={`${styles.compareBlock} ${styles.before}`} data-stack>
          <p className={styles.eyebrow}>Generic SPL wallet</p>
          <h2>A balance tells only half the story.</h2>
          <dl><div><dt>Token</dt><dd>SPACEX</dd></div><div><dt>Balance</dt><dd>2.50</dd></div><div><dt>Next step</dt><dd>Unknown</dd></div></dl>
        </div>
        <div className={`${styles.compareBlock} ${styles.after}`} data-stack>
          <p className={styles.eyebrow}>With ActionKit</p>
          <h2>Sourced context and an honest next step.</h2>
          <dl><div><dt>Lifecycle</dt><dd>IPO notice</dd></div><div><dt>State</dt><dd>Action required</dd></div><div><dt>Execution</dt><dd>Unavailable until verified</dd></div><div><dt>Source</dt><dd>Official PreStocks page</dd></div></dl>
        </div>
      </section>

      <section className={styles.integrate} id="integrate">
        <div className={styles.integrateIntro} data-scrub>
          <h2>{"Integrate the API or render the component.".split(" ").map((word, index) => <span data-scrub-word key={`${word}-${index}`}>{word} </span>)}</h2>
          <p>The components call the same typed SDK. Lifecycle selection and resolution logic remain on the server.</p>
        </div>
        <div className={styles.codeGrid}>
          <div><h3>TypeScript SDK</h3><pre><code>{code}</code></pre></div>
          <div><h3>React component</h3><pre><code>{reactCode}</code></pre></div>
        </div>
      </section>

      <section className={styles.inspect} id="inspect">
        <div className={styles.inspectHeading}><div><h2>Inspect a real mainnet wallet.</h2><p>Read-only. Mainnet. No signature.</p></div><p>Live results come from your configured Solana RPC and the official PreStocks asset registry.</p></div>
        <form className={styles.walletForm} onSubmit={(event) => { event.preventDefault(); setWallet(draft.trim()); }}>
          <label className={styles.srOnly} htmlFor="wallet">Solana wallet address</label>
          <input id="wallet" onChange={(event) => setDraft(event.target.value)} placeholder="Enter a public Solana wallet address" spellCheck={false} value={draft} />
          <button type="submit" disabled={!draft.trim()}>Inspect wallet <span aria-hidden>→</span></button>
        </form>
        <div className={styles.liveResult}>
          {wallet ? <PreStocksActions wallet={wallet} /> : <div className="ak-state"><strong className="ak-state-title">Waiting for a wallet</strong><p className="ak-state-copy">Paste a public address to request live ActionKit actions.</p></div>}
        </div>
      </section>

      <footer className={styles.footer}><h2>Add lifecycle awareness in one component.</h2><a className={styles.primary} href="#integrate">Read the integration <span aria-hidden>→</span></a></footer>
    </main>
  );
}
