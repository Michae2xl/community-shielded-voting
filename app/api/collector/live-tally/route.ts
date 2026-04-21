import { NextResponse } from "next/server";
import { readCollectorTally } from "@/lib/services/collector-tally";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const tally = await readCollectorTally();
  return NextResponse.json(tally);
}
