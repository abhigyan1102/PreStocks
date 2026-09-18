import { getCompiledTransactionMessageDecoder, getTransactionDecoder, isAddress } from "@solana/kit";

export interface QuoteRequest {
  mode: "live";
  wallet: string;
  inputMint: string;
  outputMint: string;
  inputRawAmount: string;
}

export interface VerifiedQuote {
  provider: "Jupiter";
  inputMint: string;
  outputMint: string;
  inputRawAmount: string;
  outputRawAmount: string;
  router: string;
  requestId: string;
  quoteTimestamp: string;
  /** Kept on the server for validation; never sent to the public quote response. */
  unsignedTransaction: string;
}

export interface ExecutionRouter {
  getQuote(request: QuoteRequest): Promise<VerifiedQuote | null>;
}

export class RouterConfigurationError extends Error {}
export class RouterReadError extends Error {}
export class QuoteValidationError extends Error {}

function positiveInteger(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function transactionRequiresWallet(encoded: string, wallet: string): boolean {
  try {
    const decoded = getTransactionDecoder().decode(Buffer.from(encoded, "base64"));
    const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
    return Object.hasOwn(decoded.signatures, wallet) && "instructions" in message && message.instructions.length > 0;
  } catch { return false; }
}

/** A quote is usable only when Jupiter's order matches this exact wallet plan. */
export function verifyJupiterOrder(request: QuoteRequest, raw: unknown, now = new Date()): VerifiedQuote | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const order = raw as Record<string, unknown>;
  if (
    order.inputMint !== request.inputMint || order.outputMint !== request.outputMint ||
    order.inAmount !== request.inputRawAmount || !positiveInteger(order.outAmount) ||
    typeof order.router !== "string" || !order.router.trim() ||
    typeof order.requestId !== "string" || !order.requestId.trim() ||
    typeof order.transaction !== "string" || !order.transaction ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(order.transaction)
  ) return null;
  if (order.expireAt !== undefined && order.expireAt !== null) {
    const expiry = typeof order.expireAt === "number" ? order.expireAt :
      typeof order.expireAt === "string" ? (Number.isFinite(Number(order.expireAt)) ? Number(order.expireAt) : Date.parse(order.expireAt)) : NaN;
    const expiryMs = expiry < 1e12 ? expiry * 1000 : expiry;
    if (!Number.isFinite(expiryMs) || expiryMs <= now.getTime()) return null;
  }
  if (!transactionRequiresWallet(order.transaction, request.wallet)) return null;
  return {
    provider: "Jupiter",
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    inputRawAmount: request.inputRawAmount,
    outputRawAmount: order.outAmount,
    router: order.router,
    requestId: order.requestId,
    quoteTimestamp: now.toISOString(),
    unsignedTransaction: order.transaction,
  };
}

export function assertFreshQuote(request: QuoteRequest, quote: VerifiedQuote | null, now = new Date()): VerifiedQuote {
  const timestamp = quote ? Date.parse(quote.quoteTimestamp) : NaN;
  if (request.mode !== "live" || !quote || quote.provider !== "Jupiter" || quote.inputMint !== request.inputMint || quote.outputMint !== request.outputMint ||
      quote.inputRawAmount !== request.inputRawAmount || !positiveInteger(quote.outputRawAmount) ||
      !isAddress(request.wallet) || !Number.isFinite(timestamp) || timestamp > now.getTime() ||
      now.getTime() - timestamp > 15_000 || !quote.unsignedTransaction || !quote.requestId || !quote.router ||
      !transactionRequiresWallet(quote.unsignedTransaction, request.wallet)) {
    throw new QuoteValidationError("Quote is absent, stale, or does not match the live position");
  }
  return quote;
}

export function quoteResolutionStatus(
  request: QuoteRequest,
  quote: VerifiedQuote | null,
  now = new Date(),
): "EXECUTABLE" | "NO_EXECUTABLE_ROUTE" {
  if (!quote) return "NO_EXECUTABLE_ROUTE";
  assertFreshQuote(request, quote, now);
  return "EXECUTABLE";
}

/** For a later wallet-signing UI: return only a freshly verified order's unsigned bytes. */
export function getUnsignedTransactionForReview(request: QuoteRequest, quote: VerifiedQuote | null, now = new Date()): string {
  return assertFreshQuote(request, quote, now).unsignedTransaction;
}

export class JupiterExecutionRouter implements ExecutionRouter {
  constructor(private readonly apiKey = process.env.JUPITER_API_KEY) {
    if (!apiKey?.trim()) throw new RouterConfigurationError("JUPITER_API_KEY is required for route checks");
  }

  async getQuote(request: QuoteRequest): Promise<VerifiedQuote | null> {
    if (!isAddress(request.wallet) || !isAddress(request.inputMint) || !isAddress(request.outputMint) ||
        request.inputMint === request.outputMint || !positiveInteger(request.inputRawAmount)) return null;
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.inputRawAmount,
      taker: request.wallet,
    });
    let response: Response;
    try {
      response = await fetch(`https://api.jup.ag/swap/v2/order?${params}`, {
        headers: { "x-api-key": this.apiKey! },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } catch { throw new RouterReadError("Jupiter route check failed"); }
    if (response.status === 404) return null;
    if (!response.ok) throw new RouterReadError("Jupiter route check failed");
    let raw: unknown;
    try { raw = await response.json(); }
    catch { throw new RouterReadError("Jupiter returned invalid order data"); }
    return verifyJupiterOrder(request, raw);
  }
}
