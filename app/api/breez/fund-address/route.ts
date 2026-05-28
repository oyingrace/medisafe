import { NextResponse } from "next/server";
import { getSparkFundingAddress } from "@/lib/breez";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getSparkFundingAddress();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      funding: data,
      nextStep:
        "Send regtest funds from the Lightspark faucet to this address, then call /api/breez/payments to observe updates.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Could not generate funding address",
      },
      { status: 400 },
    );
  }
}
