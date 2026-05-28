import { NextResponse } from "next/server";
import { z } from "zod";
import { paySparkInvoice } from "@/lib/breez";

export const runtime = "nodejs";

const schema = z.object({
  invoice: z.string().trim().min(10),
  amountSats: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const payment = await paySparkInvoice(body.invoice, body.amountSats);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      payment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Invoice payment failed",
      },
      { status: 400 },
    );
  }
}
