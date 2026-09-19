"use client";

import { useState } from "react";
import { PreStocksActionsView } from "@/components/actionkit";
import type { ActionPosition, WalletActionsResponse } from "@/sdk";
import styles from "./IntegrationProof.module.css";

type IntegrationMode = "react" | "sdk" | "rest";

const snippets: Record<IntegrationMode, string> = {
  react: `import { PreStocksActions } from "./components/actionkit";

export function WalletActions({ publicKey }: { publicKey: string }) {
  return <PreStocksActions wallet={publicKey} />;
}`,
  sdk: `import { PreStocksActionKit } from "./sdk";

const kit = new PreStocksActionKit({
  baseUrl: window.location.origin,
});

const result = await kit.wallet.getActions(wallet);`,
  rest: `GET /api/v1/wallet/:address/actions

// Official holdings + lifecycle state + sourced actions
// Read-only. No wallet signature required.`,
};

const modeLabels: Record<IntegrationMode, string> = {
  react: "React",
  sdk: "TypeScript SDK",
  rest: "REST API",
};

function CodeSurface({ mode, onModeChange }: { mode: IntegrationMode; onModeChange: (mode: IntegrationMode) => void }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(snippets[mode]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={styles.codeSurface}>
      <div className={styles.codeTopline}>
        <span>Add ActionKit</span>
        <button type="button" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Integration method">
        {(Object.keys(modeLabels) as IntegrationMode[]).map((item) => (
          <button
            aria-controls="integration-code-panel"
            aria-selected={mode === item}
            className={mode === item ? styles.activeTab : ""}
            id={`integration-tab-${item}`}
            key={item}
            onClick={() => { onModeChange(item); setCopied(false); }}
            role="tab"
            tabIndex={mode === item ? 0 : -1}
            type="button"
          >
            {modeLabels[item]}
          </button>
        ))}
      </div>
      <pre aria-labelledby={`integration-tab-${mode}`} id="integration-code-panel" role="tabpanel"><code>{snippets[mode]}</code></pre>
      <span className={styles.copyStatus} aria-live="polite">{copied ? "Code copied to clipboard." : ""}</span>
    </div>
  );
}

export function IntegrationProof({ examplePosition }: { examplePosition: ActionPosition | null }) {
  const [mode, setMode] = useState<IntegrationMode>("react");
  const exampleData: WalletActionsResponse = {
    mode: "live",
    product: "PreStocks ActionKit",
    wallet: "INTEGRATION_EXAMPLE",
    positions: examplePosition ? [examplePosition] : [],
    summary: {
      prestocksPositions: examplePosition ? 1 : 0,
      positionsRequiringAction: examplePosition?.status === "ACTION_REQUIRED" ? 1 : 0,
    },
    sources: {
      assets: "PRESTOCKS_OFFICIAL_API",
      balances: "SOLANA_RPC",
      lifecycle: "reviewed source snapshot",
      actions: "DERIVED",
    },
  };
  const exampleMint = examplePosition?.mint ?? "PreANxuX…rHsfTh";

  return (
    <div className={styles.proof}>
      <section className={styles.comparison} aria-labelledby="integration-proof-title">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>Integration example · illustrative balance</span>
            <h3 id="integration-proof-title">Make the same wallet PreStocks-aware.</h3>
          </div>
          <p>The example below uses sourced product and lifecycle data with an illustrative 12.40 token balance. It does not represent live wallet activity or an executable migration.</p>
        </div>

        <div className={styles.compareGrid}>
          <article className={`integration-stage ${styles.integrationStage} ${styles.beforePanel}`}>
            <span className={styles.stageLabel}>Before</span>
            <h4>Generic Solana wallet</h4>
            <div className={styles.positionHeadline}><strong>SPACEX</strong><span>12.40</span></div>
            <dl>
              <div><dt>Mint address</dt><dd>{exampleMint}</dd></div>
              <div><dt>Token balance</dt><dd>12.40</dd></div>
              <div><dt>Context</dt><dd>Unknown SPL token</dd></div>
              <div><dt>Next step</dt><dd>Unavailable</dd></div>
            </dl>
          </article>

          <span className={styles.connector} aria-hidden="true">→</span>

          <article className={`integration-stage ${styles.integrationStage} ${styles.addPanel}`}>
            <CodeSurface mode={mode} onModeChange={setMode} />
            <p>Repository usage. The package is not published to npm.</p>
          </article>

          <span className={styles.connector} aria-hidden="true">→</span>

          <article className={`integration-stage ${styles.integrationStage} ${styles.afterPanel}`}>
            <span className={styles.stageLabel}>After · example ActionKit output</span>
            <h4>PreStocks position</h4>
            <PreStocksActionsView state={{ status: "ready", data: exampleData }} />
            <dl className={styles.resolutionFacts}>
              <div><dt>Execution</dt><dd>Not currently verified</dd></div>
              <div><dt>Resolution</dt><dd>Issuer or manual flow until a verified route exists</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section className={styles.flagship} aria-labelledby="flagship-title">
        <div className={styles.flagshipIntro}>
          <span className={styles.eyebrow}>Flagship API</span>
          <h3 id="flagship-title">One call.<br />The position&apos;s next action.</h3>
          <p>The SDK returns official holdings, lifecycle state, normalized actions, and source lineage through the same backend contract.</p>
        </div>
        <div className={styles.apiFlow}>
          <div className={styles.walletNode}><span>Wallet</span><strong>7F3k9Q2mN8eP…v4Z1</strong></div>
          <span className={styles.apiArrow} aria-hidden="true">→</span>
          <pre className={styles.apiCall}><code><span>const result =</span>{"\n"}await kit.wallet.getActions(wallet);</code></pre>
          <span className={styles.apiArrow} aria-hidden="true">→</span>
          <div className={styles.apiOutput}>
            <div><strong>OPENAI</strong><span>ACTIVE</span></div>
            <div><strong>SPACEX</strong><span className={styles.required}>ACTION_REQUIRED</span></div>
          </div>
        </div>
        <div className={styles.apiNote}><span>Repository usage</span><span>Read-only response</span><span>No wallet signature</span></div>
      </section>
    </div>
  );
}
