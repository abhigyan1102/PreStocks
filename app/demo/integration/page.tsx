import type { Metadata } from "next";
import { IntegrationDemo } from "./IntegrationDemo";

export const metadata: Metadata = {
  title: "ActionKit integration demo | PreStocks",
  description: "See how PreStocks ActionKit adds sourced lifecycle context to a Solana wallet interface.",
};

export default function IntegrationDemoPage() {
  return <IntegrationDemo />;
}

