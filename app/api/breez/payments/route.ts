import { NextResponse } from "next/server";
import { listSparkPayments } from "@/lib/breez";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  try {
    const payments = await listSparkPayments(limit);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      count: payments.length,
      payments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Could not fetch Breez payments",
      },
      { status: 503 },
    );
  }
}
