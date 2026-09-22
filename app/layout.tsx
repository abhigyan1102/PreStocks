import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreStocks Radar | What should PreStocks tokenize next?",
  description: "Allocate 100 signal points across private-company candidates and explore real PreStocks community demand.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
