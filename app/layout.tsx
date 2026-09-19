import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreStocks ActionKit | Make Solana apps PreStocks-native",
  description: "Official PreStocks assets, wallet holdings, position actions, and lifecycle transitions through one integration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
