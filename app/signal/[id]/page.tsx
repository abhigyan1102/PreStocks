import type { Metadata } from "next";
import { ResultView } from "./result-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My signal | PreStocks Radar", description: "A shareable community demand signal from PreStocks Radar." };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultView id={id} />;
}
