"use client";

import { useEffect, useRef, useState } from "react";
import type { WalletAccount } from "@wallet-standard/base";
import { connectRadarWallet, signRadarChallenge, type SignInChallenge, type SupportedWallet } from "@/lib/radar/wallet-sign-in";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Sign-in request failed");
  return result;
}

export function WalletSignIn({ wallets, onClose, onSignedIn }: {
  wallets: SupportedWallet[]; onClose: () => void; onSignedIn: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const [connection, setConnection] = useState<{ wallet: SupportedWallet; account: WalletAccount; challenge: SignInChallenge } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { active.current = false; element?.close(); previousFocus?.focus(); };
  }, []);

  async function connect(wallet: SupportedWallet) {
    setBusy(true); setError("");
    try {
      const account = await connectRadarWallet(wallet);
      if (!active.current) return;
      const challenge = await post<SignInChallenge>("/api/radar/challenge", { wallet: account.address });
      setConnection({ wallet, account, challenge });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Wallet connection was declined."); }
    finally { setBusy(false); }
  }

  async function signIn() {
    if (!connection) return;
    setBusy(true); setError("");
    try {
      const signed = await signRadarChallenge(connection.wallet, connection.account, connection.challenge, window.location.origin);
      if (!active.current) return;
      await post("/api/radar/verify", signed);
      await onSignedIn();
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Wallet sign-in was declined."); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-dialog-title" onCancel={onClose}>
    <div className="dialog-heading"><span className="brand">PreStocks <span>/ Radar</span></span><button className="icon-button" aria-label="Close wallet sign-in" onClick={onClose}>×</button></div>
    <h2 id="wallet-dialog-title">{connection ? "Review your sign-in." : "Connect your wallet."}</h2>
    <p>{connection ? "Your wallet is connected. Sign the message below to start a Radar session. Publishing your signal is a separate step." : "Choose a Solana wallet. Connecting shares your public address; it does not request a signature."}</p>
    {connection ? <>
      <dl className="sign-in-summary"><div><dt>Website</dt><dd>{connection.challenge.signInInput.domain}</dd></div><div><dt>Wallet</dt><dd>{connection.wallet.name} · {connection.account.address.slice(0, 6)}…{connection.account.address.slice(-6)}</dd></div><div><dt>Request</dt><dd>Sign-in message · expires in 5 minutes</dd></div></dl>
      <details className="message-preview"><summary>View the exact message</summary><pre>{connection.challenge.message}</pre></details>
      <button className="radar-button" onClick={() => void signIn()} disabled={busy}>{busy ? "Waiting for wallet…" : "Sign in to Radar"}<span aria-hidden="true">→</span></button>
    </> : <div className="wallet-options">{wallets.length ? wallets.map((wallet) => <button key={wallet.name} onClick={() => void connect(wallet)} disabled={busy}>{wallet.name}<span aria-hidden="true">→</span></button>) : <p className="wallet-empty">No compatible wallet detected. Open Radar in a browser with your Solana wallet extension enabled, then try again.</p>}</div>}
    {busy && !connection && <p role="status">Waiting for wallet connection…</p>}
    {error && <div className="radar-error" role="alert"><strong>Sign-in was not completed.</strong><p>{error}</p><p>If your wallet displays a security warning, stop here and report its exact wording. Do not override the warning.</p></div>}
    <p className="dialog-note">No transaction, token approval, or private key is requested. A signature proves control of an address, not a unique identity.</p>
  </dialog>;
}
