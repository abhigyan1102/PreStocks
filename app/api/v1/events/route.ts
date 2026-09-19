import { NextResponse } from "next/server";
import { lifecycleProvider } from "@/lib/lifecycle";

export async function GET() {
  const events = await lifecycleProvider.getEvents();
  return NextResponse.json({ provider: lifecycleProvider.info, provenance: "reviewed static source snapshot", events });
}
