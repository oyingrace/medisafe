import { BatchTable } from "@/components/BatchTable";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBatchesWithVerificationCounts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const rows = await listBatchesWithVerificationCounts();

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-green-800">Batches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter by payment status, sort columns, and open a batch for full verification history on Nostr-linked
          registrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All batches</CardTitle>
          <CardDescription>
            Verification counts reflect rows in <code>verification_logs</code> per batch.
          </CardDescription>
        </CardHeader>
        <div className="border-t px-4 pb-6 pt-2">
          <BatchTable rows={rows} />
        </div>
      </Card>
    </main>
  );
}
