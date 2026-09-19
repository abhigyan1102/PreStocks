export function ProductModel() {
  const outputs = [
    { name: "Holdings", detail: "Official positions" },
    { name: "Actions", detail: "Relevant next steps" },
    { name: "Continuity", detail: "Lifecycle context" },
    { name: "Resolution", detail: "Explicit route state" },
  ];

  return (
    <section className="product-model page-gutter" aria-labelledby="product-model-title">
      <div className="section-head"><span>Product model</span><span>From ownership to context</span></div>
      <div className="product-model-intro">
        <h2 id="product-model-title">
          <span className="model-reveal">One integration.</span>{" "}
          <span className="model-reveal">Complete position context.</span>
        </h2>
        <p>ActionKit turns raw token ownership into sourced, actionable position context.</p>
      </div>

      <div className="model-diagram" aria-label="PreStocks API, Solana wallets, and lifecycle sources feed ActionKit, which returns holdings, actions, continuity, and resolution context.">
        <div className="model-inputs">
          <div><strong>PreStocks API</strong><span>Asset identity and market data</span></div>
          <div><strong>Solana wallet</strong><span>Onchain holdings and balances</span></div>
          <div><strong>Lifecycle sources</strong><span>Reviewed events and metadata</span></div>
        </div>
        <div className="model-merge" aria-hidden="true"><i /><i /><i /></div>
        <div className="model-core"><strong>ActionKit</strong><span>One server-side contract</span></div>
        <div className="model-split" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="model-outputs">
          {outputs.map((output) => <div key={output.name}><strong>{output.name}</strong><span>{output.detail}</span></div>)}
        </div>
      </div>
    </section>
  );
}
