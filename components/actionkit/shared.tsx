"use client";

import { useEffect, useMemo, useState } from "react";
import { PreStocksActionKit } from "../../sdk";

export type RemoteState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function useActionKitRequest<T>(
  load: (kit: PreStocksActionKit) => Promise<T>,
  dependencies: readonly unknown[],
  options?: { baseUrl?: string; client?: PreStocksActionKit },
): RemoteState<T> {
  const kit = useMemo(
    () => options?.client ?? new PreStocksActionKit({ baseUrl: options?.baseUrl }),
    [options?.baseUrl, options?.client],
  );
  const [state, setState] = useState<RemoteState<T>>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    load(kit).then(
      (data) => { if (current) setState({ status: "ready", data }); },
      (error: unknown) => {
        if (current) setState({ status: "error", message: error instanceof Error ? error.message : "ActionKit request failed" });
      },
    );
    return () => { current = false; };
    // The caller controls the stable request dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, ...dependencies]);
  return state;
}

export function StateMessage({
  state,
  empty,
  children,
}: {
  state: RemoteState<unknown>;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  if (state.status === "loading") {
    return <div className="ak-state" aria-live="polite"><strong className="ak-state-title">Reading mainnet positions</strong><p className="ak-state-copy">Checking the wallet through the configured Solana RPC.</p></div>;
  }
  if (state.status === "error") {
    return <div className="ak-state" role="alert"><strong className="ak-state-title">Wallet inspection failed</strong><p className="ak-state-copy">{state.message}</p></div>;
  }
  if (empty) {
    return <div className="ak-state"><strong className="ak-state-title">No PreStocks positions</strong><p className="ak-state-copy">The wallet is valid, but no balance matches the current official PreStocks registry.</p></div>;
  }
  return <>{children}</>;
}
