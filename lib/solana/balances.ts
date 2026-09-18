/** Render an integer token amount without converting it through a JS number. */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("Invalid token amount or decimals");
  }
  const digits = raw.toString();
  if (decimals === 0) return digits;
  const padded = digits.padStart(decimals + 1, "0");
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
}
