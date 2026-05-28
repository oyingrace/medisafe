import { createHash } from "crypto";

type BreezSdkModule = typeof import("@breeztech/breez-sdk-spark/nodejs");
type SparkNetwork = "regtest" | "mainnet";
type PaymentStatus = "pending" | "paid" | "failed";
type BreezPayment = import("@breeztech/breez-sdk-spark/nodejs").Payment;

const paidHashes = new Set<string>();
const paymentCreatedAt = new Map<string, number>();
const invoiceBySyntheticHash = new Map<string, string>();

const REGISTRATION_SATS = Number(process.env.BATCH_REGISTRATION_SATS ?? 100);
const DEFAULT_EXPIRY_SECS = 15 * 60;

let sdkModulePromise: Promise<BreezSdkModule> | null = null;
let sparkSdkPromise: Promise<import("@breeztech/breez-sdk-spark/nodejs").BreezSdk> | null = null;

function isMockMode() {
  if (process.env.BREEZ_MODE === "mock") return true;
  if (process.env.BREEZ_MODE === "spark") return false;
  return !process.env.BREEZ_MNEMONIC?.trim();
}

function normalizeNetwork(value: string | undefined): SparkNetwork {
  return value === "mainnet" ? "mainnet" : "regtest";
}

function syntheticPaymentHash(invoice: string) {
  const digest = createHash("sha256").update(invoice).digest("hex");
  return `spark_${digest.slice(0, 40)}`;
}

async function getSparkModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import("@breeztech/breez-sdk-spark/nodejs");
  }
  return sdkModulePromise;
}

async function getSparkSdk() {
  if (isMockMode()) {
    throw new Error("BREEZ configured for mock mode");
  }
  if (!sparkSdkPromise) {
    sparkSdkPromise = (async () => {
      const mod = await getSparkModule();
      const network = normalizeNetwork(process.env.BREEZ_NETWORK);
      const mnemonic = process.env.BREEZ_MNEMONIC?.trim();
      if (!mnemonic) {
        throw new Error("BREEZ_MNEMONIC is required for real Breez Spark mode");
      }

      const config = mod.defaultConfig(network);
      const apiKey = process.env.BREEZ_API_KEY?.trim();
      if (apiKey) {
        config.apiKey = apiKey;
      }
      const storageDir = process.env.BREEZ_WORKING_DIR?.trim() || "./breez-data";

      const sdk = await mod.connect({
        config,
        seed: {
          type: "mnemonic",
          mnemonic,
          passphrase: process.env.BREEZ_MNEMONIC_PASSPHRASE?.trim() || undefined,
        },
        storageDir,
      });
      await sdk.syncWallet({});
      return sdk;
    })();
  }
  return sparkSdkPromise;
}

function mapSdkStatus(status: string): PaymentStatus {
  if (status === "completed") return "paid";
  if (status === "failed") return "failed";
  return "pending";
}

function toNumberSafe(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

export async function initBreezSDK() {
  if (isMockMode()) {
    return {
      initialized: true,
      mode: "mock" as const,
      network: normalizeNetwork(process.env.BREEZ_NETWORK),
    };
  }
  await getSparkSdk();
  return {
    initialized: true,
    mode: "spark" as const,
    network: normalizeNetwork(process.env.BREEZ_NETWORK),
  };
}

export async function createBatchInvoice(batchId: string) {
  if (isMockMode()) {
    const paymentHash = `ph_${batchId}_${crypto.randomUUID().slice(0, 8)}`;
    paymentCreatedAt.set(paymentHash, Date.now());
    return {
      invoice: `lnbc${REGISTRATION_SATS}${paymentHash}`,
      paymentHash,
      amountSats: REGISTRATION_SATS,
      mode: "mock" as const,
    };
  }

  const sdk = await getSparkSdk();
  await sdk.syncWallet({});
  const res = await sdk.receivePayment({
    paymentMethod: {
      type: "bolt11Invoice",
      description: `MedSafe batch registration ${batchId}`,
      amountSats: REGISTRATION_SATS,
      expirySecs: DEFAULT_EXPIRY_SECS,
    },
  });

  const invoice = res.paymentRequest;
  const paymentHash = syntheticPaymentHash(invoice);
  invoiceBySyntheticHash.set(paymentHash, invoice);
  return {
    invoice,
    paymentHash,
    amountSats: REGISTRATION_SATS,
    mode: "spark" as const,
  };
}

export async function checkPaymentStatus(paymentHash: string): Promise<PaymentStatus> {
  if (isMockMode()) {
    if (paidHashes.has(paymentHash)) return "paid";

    const createdAt = paymentCreatedAt.get(paymentHash);
    if (!createdAt) return "failed";

    if (Date.now() - createdAt > 3000) {
      paidHashes.add(paymentHash);
      return "paid";
    }
    return "pending";
  }

  const invoice = invoiceBySyntheticHash.get(paymentHash);
  if (!invoice) {
    return "failed";
  }

  const sdk = await getSparkSdk();
  await sdk.syncWallet({});
  const list = await sdk.listPayments({
    typeFilter: ["receive"],
    statusFilter: ["pending", "completed", "failed"],
    limit: 200,
    sortAscending: false,
  });

  const hit = list.payments.find((payment) => {
    const details = payment.details;
    return details?.type === "lightning" && details.invoice === invoice;
  });

  if (!hit) return "pending";
  return mapSdkStatus(hit.status);
}

export async function getBreezDebugStatus() {
  const network = normalizeNetwork(process.env.BREEZ_NETWORK);

  if (isMockMode()) {
    return {
      mode: "mock" as const,
      network,
      connected: true,
      synced: true,
      balanceSats: null as number | null,
      note: "Mock mode active (set BREEZ_MODE=spark and BREEZ_MNEMONIC for real SDK).",
    };
  }

  const sdk = await getSparkSdk();
  await sdk.syncWallet({});
  const info = await sdk.getInfo({ ensureSynced: true });

  return {
    mode: "spark" as const,
    network,
    connected: true,
    synced: true,
    balanceSats: Number(info.balanceSats ?? 0),
    tokenCount: info.tokenBalances?.size ?? 0,
  };
}

export async function getSparkFundingAddress() {
  if (isMockMode()) {
    throw new Error("Funding address is unavailable in mock mode. Set BREEZ_MODE=spark.");
  }
  const sdk = await getSparkSdk();
  await sdk.syncWallet({});
  const res = await sdk.receivePayment({
    paymentMethod: {
      type: "bitcoinAddress",
    },
  });
  return {
    address: res.paymentRequest,
    feeSats: toNumberSafe(res.fee),
    network: normalizeNetwork(process.env.BREEZ_NETWORK),
  };
}

function serializePayment(payment: BreezPayment) {
  return {
    id: payment.id,
    paymentType: payment.paymentType,
    status: payment.status,
    amountSats: toNumberSafe(payment.amount),
    feesSats: toNumberSafe(payment.fees),
    timestamp: payment.timestamp,
    method: payment.method,
    detailsType: payment.details?.type ?? null,
    invoice:
      payment.details?.type === "lightning"
        ? payment.details.invoice
        : payment.details?.type === "spark"
          ? payment.details.invoiceDetails?.invoice ?? null
          : payment.details?.type === "token"
            ? payment.details.invoiceDetails?.invoice ?? null
            : null,
    paymentHash:
      payment.details?.type === "lightning"
        ? payment.details.paymentHash
        : payment.details?.type === "spark"
          ? payment.details.htlcDetails?.paymentHash ?? null
          : null,
  };
}

export async function listSparkPayments(limit = 50) {
  if (isMockMode()) {
    return [];
  }
  const sdk = await getSparkSdk();
  await sdk.syncWallet({});
  const list = await sdk.listPayments({
    limit: Math.max(1, Math.min(200, Math.floor(limit))),
    sortAscending: false,
  });
  return list.payments.map(serializePayment);
}
