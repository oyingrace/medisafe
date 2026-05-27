import Link from "next/link";
import { RecentActivity } from "@/components/RecentActivity";
import { StatsCard } from "@/components/StatsCard";
import {
  getDashboardStats,
  getRecentBatchActivity,
  getRecentVerificationActivity,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = await getDashboardStats();
  const [verificationRows, batchRows] = await Promise.all([
    getRecentVerificationActivity(12),
    getRecentBatchActivity(8),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 p-6 pb-12">
      <section className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <h1 className="text-3xl font-bold text-green-800">MedSafe</h1>
        <p className="mt-2 text-zinc-700">
          Drug batch verification using Nostr for records and Lightning for anti-spam registration.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/register" className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Register Batch
          </Link>
          <Link href="/batches" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 hover:bg-zinc-50">
            View Batches
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Dashboard</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Registered batches" value={stats.registeredBatches} />
          <StatsCard title="Pending payment" value={stats.pendingBatches} />
          <StatsCard title="Total verifications" value={stats.totalVerifications} />
          <StatsCard title="Open anomaly alerts" value={stats.openAlerts} />
        </div>
      </section>

      <RecentActivity verificationRows={verificationRows} batchRows={batchRows} />

      <section className="rounded-xl border border-zinc-200 p-4">
        <h2 className="text-xl font-semibold">WhatsApp verification</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Point Twilio at <code>/api/whatsapp-webhook</code>. Users send a batch ID or packaging photo (OCR via
          Tesseract.js) and get a verification reply.
        </p>
      </section>
    </main>
  );
}
