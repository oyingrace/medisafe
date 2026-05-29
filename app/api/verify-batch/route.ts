import { NextResponse } from "next/server";
import { verifyBatch } from "@/lib/verify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const userPhone = searchParams.get("userPhone") ?? undefined;
  const region = searchParams.get("region") ?? undefined;

  if (!batchId) {
    return NextResponse.json({ success: false, error: "batchId is required" }, { status: 400 });
  }

  const result = await verifyBatch(batchId, userPhone, region);
  return NextResponse.json({ success: true, ...result });
}
