import { NextResponse } from "next/server";
import { lifecycleProvider } from "@/lib/lifecycle";

export async function GET() {
  const events = await lifecycleProvider.getEvents();
  return NextResponse.json({ provenance: "reviewed static source snapshot", events });
}
