import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian | PreStocks lifecycle context",
  description: "Sourced lifecycle context for PreStocks tokens and the wallets that hold them.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
