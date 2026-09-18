import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreStocks Continuity | Wallet-aware lifecycle actions",
  description: "When the company changes, your onchain position changes with it. Sourced PreStocks lifecycle context for real wallet holdings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
