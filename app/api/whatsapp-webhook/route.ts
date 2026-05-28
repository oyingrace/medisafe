import { NextResponse } from "next/server";
import { extractBatchIdFromImage, extractBatchIdFromText } from "@/lib/ocr";
import {
  deriveRegionHint,
  formatWhatsAppVerificationMessage,
  isGreeting,
  sendWhatsAppMessage,
  WELCOME_MESSAGE,
} from "@/lib/twilio";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const body = String(formData.get("Body") ?? "");
  const from = String(formData.get("From") ?? "");
  const mediaUrl = formData.get("MediaUrl0");

  // Respond to greetings with the welcome message
  if (isGreeting(body) && !mediaUrl) {
    await sendWhatsAppMessage(from, WELCOME_MESSAGE);
    return new NextResponse(
      `<Response><Message>${WELCOME_MESSAGE}</Message></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }

  let batchId: string | null = extractBatchIdFromText(body);
  if (!batchId && mediaUrl) {
    const ocr = await extractBatchIdFromImage(String(mediaUrl));
    batchId = ocr.batchId ?? null;
    if (!batchId && ocr.confidence > 0 && ocr.confidence < 70) {
      const reply = "⚠️ Photo unclear. Retake closer photo of batch code or type the ID as text.";
      await sendWhatsAppMessage(from, reply);
      return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }
  }

  if (!batchId) {
    const reply = "⚠️ Could not read batch ID. Please send a clear photo or text ID.";
    await sendWhatsAppMessage(from, reply);
    return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const verifyUrl = new URL("/api/verify-batch", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  verifyUrl.searchParams.set("batchId", batchId);
  verifyUrl.searchParams.set("userPhone", from);
  const regionHint = deriveRegionHint(from);
  if (regionHint) verifyUrl.searchParams.set("region", regionHint);
  const verifyResp = await fetch(verifyUrl.toString(), { method: "GET" });
  const verifyBody = (await verifyResp.json()) as { status: "verified" | "fake" | "anomaly" };
  const reply = formatWhatsAppVerificationMessage(verifyBody.status, batchId);

  await sendWhatsAppMessage(from, reply);
  return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
