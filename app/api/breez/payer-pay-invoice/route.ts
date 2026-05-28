import { NextResponse } from "next/server";
import { z } from "zod";
import { payInvoiceFromPayer } from "@/lib/breez";

export const runtime = "nodejs";

const schema = z.object({
  invoice: z.string().trim().min(10),
  amountSats: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const payment = await payInvoiceFromPayer(parsed.data.invoice, parsed.data.amountSats);
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), payment });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
