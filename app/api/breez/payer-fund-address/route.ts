import { NextResponse } from "next/server";
import { getPayerFundingAddress } from "@/lib/breez";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getPayerFundingAddress();
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
