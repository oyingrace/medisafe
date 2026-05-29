import { logAndCheckAnomaly } from "@/lib/anomaly";
import { isTrustedManufacturer, queryBatchById, verifyEventSignature } from "@/lib/nostr";

export type VerifyStatus = "verified" | "fake" | "anomaly";

export interface VerifyResult {
  status: VerifyStatus;
  reason?: string;
  details?: {
    batchId: string;
    drugName: string;
    manufacturer: string;
    manufactureDate: string;
    expiryDate: string;
    paymentHash: string;
    eventId: string;
    createdAt: number;
  };
}

function toDetails(event: Awaited<ReturnType<typeof queryBatchById>>) {
  if (!event) return undefined;
  const map = new Map(event.tags.map((t) => [t[0], t[1]]));
  return {
    batchId: map.get("d") ?? "",
    drugName: map.get("drug_name") ?? "",
    manufacturer: map.get("manufacturer") ?? "",
    manufactureDate: map.get("manufacture_date") ?? "",
    expiryDate: map.get("expiry_date") ?? "",
    paymentHash: map.get("lightning_payment_hash") ?? "",
    eventId: event.id,
    createdAt: event.created_at,
  };
}

export async function verifyBatch(
  rawBatchId: string,
  userPhone?: string,
  region?: string,
): Promise<VerifyResult> {
  const normalizedId = rawBatchId.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const event = await queryBatchById(normalizedId);
  if (!event) {
    await logAndCheckAnomaly(normalizedId, "fake", userPhone, region);
    return { status: "fake", reason: "not_found" };
  }
  if (!verifyEventSignature(event)) {
    await logAndCheckAnomaly(normalizedId, "fake", userPhone, region);
    return { status: "fake", reason: "bad_signature" };
  }
  if (!isTrustedManufacturer(event)) {
    await logAndCheckAnomaly(normalizedId, "fake", userPhone, region);
    return { status: "fake", reason: "wrong_manufacturer_pubkey" };
  }

  const anomaly = await logAndCheckAnomaly(normalizedId, "verified", userPhone, region);
  if (anomaly.isAnomaly) {
    return { status: "anomaly", details: toDetails(event) };
  }

  return { status: "verified", details: toDetails(event) };
}
