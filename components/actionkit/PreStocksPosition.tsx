import type { ActionPosition } from "../../sdk";

export function PreStocksPosition({ position }: { position: ActionPosition }) {
  const market = position.market.tokenPrice === null && position.market.markPrice === null
    ? "Unavailable"
    : [
        position.market.tokenPrice === null ? null : `Token $${position.market.tokenPrice.toFixed(2)}`,
        position.market.markPrice === null ? null : `Mark $${position.market.markPrice.toFixed(2)}`,
      ].filter(Boolean).join(" · ");

  return (
    <article className="ak-root ak-position">
      <header className="ak-position-header">
        <div><strong className="ak-symbol">{position.symbol}</strong><div className="ak-meta">{position.name}</div></div>
        <div><span className="ak-balance">{position.balance}</span><div className="ak-meta">{position.status.replaceAll("_", " ")}</div></div>
      </header>
      <div className="ak-market"><span>Official market data</span><strong>{market}</strong></div>
      <ul className="ak-action-list">
        {position.actions.map((action) => (
          <li className="ak-action" key={action.id}>
            <div className="ak-action-header"><strong className="ak-action-label">{action.label}</strong><span className="ak-meta">{action.status.replaceAll("_", " ")}</span></div>
            <p className="ak-action-description">{action.description}</p>
            {action.source.url ? <a className="ak-action-link" href={action.source.url} rel="noreferrer" target="_blank">Open sourced information</a> : null}
            <small className="ak-source">Source: {action.source.name}. {action.source.reason}</small>
          </li>
        ))}
      </ul>
    </article>
  );
}
