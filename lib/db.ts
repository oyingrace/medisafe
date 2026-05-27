import { neon } from "@neondatabase/serverless";
import type { BatchRecord, BatchRegistrationInput, VerificationStatus } from "@/types";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

const mem = {
  batches: new Map<string, BatchRecord>(),
  verifications: [] as Array<{
    batchId: string;
    result: VerificationStatus;
    userPhone?: string;
    region?: string;
    queriedAt: number;
  }>,
  anomalyAlerts: [] as Array<{ batchId: string; alertType: string; regions: string[]; resolved: boolean; flaggedAt: number }>,
};

let idSeq = 1;

export async function createPendingBatch(
  input: BatchRegistrationInput,
  paymentHash: string,
  invoice: string,
) {
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS medsafe_batches (
        id SERIAL PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        manufacture_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_hash TEXT,
        invoice TEXT,
        nostr_event_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO medsafe_batches (
        batch_id, drug_name, manufacturer, manufacture_date, expiry_date, status, payment_hash, invoice
      ) VALUES (
        ${input.batchId}, ${input.drugName}, ${input.manufacturer}, ${input.manufactureDate}, ${input.expiryDate}, 'pending_payment', ${paymentHash}, ${invoice}
      )
      ON CONFLICT (batch_id) DO UPDATE SET
        drug_name = EXCLUDED.drug_name,
        manufacturer = EXCLUDED.manufacturer,
        manufacture_date = EXCLUDED.manufacture_date,
        expiry_date = EXCLUDED.expiry_date,
        status = EXCLUDED.status,
        payment_hash = EXCLUDED.payment_hash,
        invoice = EXCLUDED.invoice
    `;
    return;
  }

  mem.batches.set(input.batchId, {
    id: idSeq++,
    ...input,
    status: "pending_payment",
    paymentHash,
    invoice,
    nostrEventId: null,
    createdAt: new Date().toISOString(),
  });
}

export async function markBatchRegistered(batchId: string, nostrEventId: string) {
  if (sql) {
    await sql`
      UPDATE medsafe_batches
      SET status = 'registered', nostr_event_id = ${nostrEventId}
      WHERE batch_id = ${batchId}
    `;
    return;
  }
  const batch = mem.batches.get(batchId);
  if (!batch) return;
  batch.status = "registered";
  batch.nostrEventId = nostrEventId;
}

export async function getBatchByPaymentHash(paymentHash: string) {
  if (sql) {
    const rows = await sql`
      SELECT * FROM medsafe_batches WHERE payment_hash = ${paymentHash} LIMIT 1
    `;
    return rows[0] as Record<string, unknown> | undefined;
  }
  return Array.from(mem.batches.values()).find((item) => item.paymentHash === paymentHash);
}

export async function listBatches() {
  if (sql) {
    const rows = await sql`SELECT * FROM medsafe_batches ORDER BY id DESC`;
    return rows as Array<Record<string, unknown>>;
  }
  return Array.from(mem.batches.values()).sort((a, b) => b.id - a.id);
}

/** Batch rows with aggregated verification counts (dashboard table). */
export async function listBatchesWithVerificationCounts(): Promise<Array<Record<string, unknown>>> {
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS medsafe_batches (
        id SERIAL PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        manufacture_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_hash TEXT,
        invoice TEXT,
        nostr_event_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    const rows = await sql`
      SELECT
        b.*,
        COALESCE(v.cnt, 0)::int AS verification_count
      FROM medsafe_batches b
      LEFT JOIN (
        SELECT batch_id, COUNT(*)::int AS cnt
        FROM verification_logs
        GROUP BY batch_id
      ) v ON v.batch_id = b.batch_id
      ORDER BY b.id DESC
    `;
    return rows as Array<Record<string, unknown>>;
  }

  const counts = new Map<string, number>();
  for (const v of mem.verifications) {
    counts.set(v.batchId, (counts.get(v.batchId) ?? 0) + 1);
  }

  const list = Array.from(mem.batches.values()).sort((a, b) => b.id - a.id);
  return list.map((b) => ({
    batch_id: b.batchId,
    drug_name: b.drugName,
    manufacturer: b.manufacturer,
    manufacture_date: b.manufactureDate,
    expiry_date: b.expiryDate,
    status: b.status,
    payment_hash: b.paymentHash,
    invoice: b.invoice,
    nostr_event_id: b.nostrEventId,
    created_at: b.createdAt,
    id: b.id,
    verification_count: counts.get(b.batchId) ?? 0,
  }));
}

export async function getBatchByBatchId(batchId: string) {
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS medsafe_batches (
        id SERIAL PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        manufacture_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_hash TEXT,
        invoice TEXT,
        nostr_event_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    const batches = await sql`SELECT * FROM medsafe_batches WHERE batch_id = ${batchId} LIMIT 1`;
    const row = batches[0];
    if (!row) return null;
    const cntRows = await sql`
      SELECT COUNT(*)::int AS c FROM verification_logs WHERE batch_id = ${batchId}
    `;
    return {
      batch: row as Record<string, unknown>,
      verificationCount: Number(cntRows[0]?.c ?? 0),
    };
  }

  const b = mem.batches.get(batchId);
  if (!b) return null;
  const verificationCount = mem.verifications.filter((v) => v.batchId === batchId).length;
  return {
    batch: {
      batch_id: b.batchId,
      drug_name: b.drugName,
      manufacturer: b.manufacturer,
      manufacture_date: b.manufactureDate,
      expiry_date: b.expiryDate,
      status: b.status,
      payment_hash: b.paymentHash,
      invoice: b.invoice,
      nostr_event_id: b.nostrEventId,
      created_at: b.createdAt,
      id: b.id,
    },
    verificationCount,
  };
}

const verifyLimitCap = (n: number) => Math.min(500, Math.max(1, Math.floor(n)));

export async function listVerificationLogsForBatch(batchId: string, limit = 100): Promise<Array<Record<string, unknown>>> {
  const cap = verifyLimitCap(limit);
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    return await sql`
      SELECT id, batch_id, result, user_phone, region, queried_at
      FROM verification_logs
      WHERE batch_id = ${batchId}
      ORDER BY queried_at DESC
      LIMIT ${cap}
    ` as Array<Record<string, unknown>>;
  }
  return mem.verifications
    .filter((v) => v.batchId === batchId)
    .sort((a, b) => b.queriedAt - a.queriedAt)
    .slice(0, cap)
    .map((v, i) => ({
      id: i,
      batch_id: v.batchId,
      result: v.result,
      user_phone: v.userPhone ?? null,
      region: v.region ?? null,
      queried_at: new Date(v.queriedAt).toISOString(),
    }));
}

/** Latest consumer checks across all batches — dashboard activity feed */
export async function getRecentVerificationActivity(limit = 12): Promise<Array<Record<string, unknown>>> {
  const cap = verifyLimitCap(limit);
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    return await sql`
      SELECT id, batch_id, result, region, queried_at
      FROM verification_logs
      ORDER BY queried_at DESC
      LIMIT ${cap}
    ` as Array<Record<string, unknown>>;
  }
  return mem.verifications
    .slice()
    .sort((a, b) => b.queriedAt - a.queriedAt)
    .slice(0, cap)
    .map((v, i) => ({
      id: i,
      batch_id: v.batchId,
      result: v.result,
      region: v.region ?? null,
      queried_at: new Date(v.queriedAt).toISOString(),
    }));
}

/** Latest batch registrations (pending or completed) — dashboard activity */
export async function getRecentBatchActivity(limit = 8): Promise<Array<Record<string, unknown>>> {
  const cap = verifyLimitCap(limit);
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS medsafe_batches (
        id SERIAL PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        manufacture_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_hash TEXT,
        invoice TEXT,
        nostr_event_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    return await sql`
      SELECT batch_id, drug_name, status, created_at
      FROM medsafe_batches
      ORDER BY created_at DESC
      LIMIT ${cap}
    ` as Array<Record<string, unknown>>;
  }

  return Array.from(mem.batches.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, cap)
    .map((b) => ({
      batch_id: b.batchId,
      drug_name: b.drugName,
      status: b.status,
      created_at: b.createdAt,
    }));
}

export async function logVerification(
  batchId: string,
  result: VerificationStatus,
  userPhone?: string,
  region?: string,
) {
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO verification_logs (batch_id, result, user_phone, region)
      VALUES (${batchId}, ${result}, ${userPhone ?? null}, ${region ?? null})
    `;
    return;
  }
  mem.verifications.push({
    batchId,
    result,
    userPhone,
    region,
    queriedAt: Date.now(),
  });
}

export async function getRecentVerifications(batchId: string, lookbackHours = 24) {
  const minTime = Date.now() - lookbackHours * 60 * 60 * 1000;
  if (sql) {
    const hours = Math.max(1, Math.min(168, Math.floor(Number(lookbackHours) || 24)));
    return await sql`
      SELECT batch_id, result, user_phone, region, queried_at
      FROM verification_logs
      WHERE batch_id = ${batchId}
        AND queried_at > NOW() - (${hours}::int * interval '1 hour')
      ORDER BY queried_at DESC
    `;
  }
  return mem.verifications.filter(
    (v) => v.batchId === batchId && v.queriedAt >= minTime,
  );
}

async function ensureAnomalyAlertsTableSql() {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS anomaly_alerts (
      id SERIAL PRIMARY KEY,
      batch_id TEXT NOT NULL,
      alert_type TEXT,
      regions TEXT[],
      flagged_at TIMESTAMPTZ DEFAULT NOW(),
      resolved BOOLEAN DEFAULT FALSE
    )
  `;
}

/** Insert an anomaly alert; `regions` must be simple strings (stored as Postgres text[]) */
export async function createAnomalyAlert(batchId: string, alertType: string, regions: string[]) {
  if (sql) {
    await ensureAnomalyAlertsTableSql();
    const safeParts = regions.map((part) => part.replace(/[^a-zA-Z0-9:_-]/g, "")).filter(Boolean);
    const safe = safeParts.join(",");
    await sql`
      INSERT INTO anomaly_alerts (batch_id, alert_type, regions)
      VALUES (
        ${batchId},
        ${alertType},
        CASE
          WHEN ${safe} = '' THEN ARRAY[]::text[]
          ELSE string_to_array(${safe}, ',')
        END
      )
    `;
    return;
  }
  mem.anomalyAlerts.push({
    batchId,
    alertType,
    regions: [...regions],
    resolved: false,
    flaggedAt: Date.now(),
  });
}

export async function getDashboardStats() {
  if (sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS medsafe_batches (
        id SERIAL PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        manufacture_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_hash TEXT,
        invoice TEXT,
        nostr_event_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL,
        result TEXT NOT NULL,
        user_phone TEXT,
        region TEXT,
        queried_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await ensureAnomalyAlertsTableSql();

    const batchRows =
      await sql`SELECT COUNT(*)::int AS c FROM medsafe_batches WHERE status = 'registered'`;
    const pendingRows =
      await sql`SELECT COUNT(*)::int AS c FROM medsafe_batches WHERE status = 'pending_payment'`;
    const verifyRows = await sql`SELECT COUNT(*)::int AS c FROM verification_logs`;
    const alertRows =
      await sql`SELECT COUNT(*)::int AS c FROM anomaly_alerts WHERE resolved = FALSE`;

    return {
      registeredBatches: Number(batchRows[0]?.c ?? 0),
      pendingBatches: Number(pendingRows[0]?.c ?? 0),
      totalVerifications: Number(verifyRows[0]?.c ?? 0),
      openAlerts: Number(alertRows[0]?.c ?? 0),
    };
  }

  const batches = [...mem.batches.values()];
  return {
    registeredBatches: batches.filter((b) => b.status === "registered").length,
    pendingBatches: batches.filter((b) => b.status === "pending_payment").length,
    totalVerifications: mem.verifications.length,
    openAlerts: mem.anomalyAlerts.filter((a) => !a.resolved).length,
  };
}
