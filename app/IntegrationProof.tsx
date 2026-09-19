"use client";

import { useState } from "react";
import styles from "./IntegrationProof.module.css";

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

const modeLabels: Record<IntegrationMode, string> = {
  react: "React",
  sdk: "TypeScript SDK",
  rest: "REST API",
};

export function IntegrationProof() {
  const [mode, setMode] = useState<IntegrationMode>("react");

  return (
    <div className={styles.proof}>
      <section className={styles.comparison} aria-labelledby="integration-proof-title">
        <div className={styles.sectionIntro}>
          <span>Before / after</span>
          <h3 id="integration-proof-title">The same position.<br />A clearer next step.</h3>
          <p>A generic token list stops at ownership. ActionKit adds sourced lifecycle context without inventing an executable route.</p>
        </div>

        <div className={styles.compareGrid}>
          <article className={styles.beforePanel}>
            <span className={styles.panelLabel}>Standard SPL wallet</span>
            <h4>A wallet sees a token.</h4>
            <dl>
              <div><dt>Identity</dt><dd>Mint address</dd></div>
              <div><dt>Position</dt><dd>Raw balance</dd></div>
              <div><dt>Next step</dt><dd>Unknown</dd></div>
            </dl>
          </article>

          <article className={styles.afterPanel}>
            <span className={styles.panelLabel}>With ActionKit</span>
            <h4>ActionKit sees what happens next.</h4>
            <dl>
              <div><dt>Identity</dt><dd>Official PreStocks mint</dd></div>
              <div><dt>Lifecycle</dt><dd>Reviewed IPO notice</dd></div>
              <div><dt>Holder state</dt><dd>Action required</dd></div>
              <div><dt>Execution</dt><dd>Unavailable until destination and route are verified</dd></div>
              <div><dt>Evidence</dt><dd>Official source URL and verification time</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section className={styles.flow} aria-labelledby="integration-flow-title">
        <div className={styles.flowHeading}>
          <span>Integration flow</span>
          <h3 id="integration-flow-title">From wallet address to an honest next action.</h3>
        </div>
        <div className={styles.flowGrid}>
          <article>
            <span>01</span>
            <h4>Detect official holdings.</h4>
            <p>Match live SPL and Token-2022 accounts against the official PreStocks mint registry.</p>
          </article>
          <article>
            <span>02</span>
            <h4>Attach sourced events.</h4>
            <p>Preserve the source URL, verification time, deadline, destination facts, and unknown values.</p>
          </article>
          <article>
            <span>03</span>
            <h4>Return normalized actions.</h4>
            <p>Return explicit informational, issuer-managed, manual, route-check, or unavailable states.</p>
          </article>
        </div>
      </section>

      <section className={styles.snippets} aria-labelledby="integration-code-title">
        <div className={styles.snippetIntro}>
          <span>Choose your surface</span>
          <h3 id="integration-code-title">One backend contract.<br />Three integration paths.</h3>
          <p>The React component calls the typed SDK. The SDK calls the same backend APIs. Lifecycle decisions stay on the server.</p>
        </div>
        <div className={styles.codeSurface}>
          <div className={styles.tabs} role="tablist" aria-label="Integration method">
            {(Object.keys(modeLabels) as IntegrationMode[]).map((item) => (
              <button
                aria-controls="integration-code-panel"
                aria-selected={mode === item}
                className={mode === item ? styles.activeTab : ""}
                id={`integration-tab-${item}`}
                key={item}
                onClick={() => setMode(item)}
                role="tab"
                type="button"
              >
                {modeLabels[item]}
              </button>
            ))}
          </div>
          <pre
            aria-labelledby={`integration-tab-${mode}`}
            id="integration-code-panel"
            role="tabpanel"
          ><code>{snippets[mode]}</code></pre>
        </div>
      </section>
    </div>
  );
}
