import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getBatchByBatchId, listVerificationLogsForBatch } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
    }
    return value;
  }
  return "—";
}

function pillForResult(result: string) {
  if (result === "verified") {
    return <Badge className="bg-green-600 hover:bg-green-700">verified</Badge>;
  }
  if (result === "fake") return <Badge variant="destructive">fake</Badge>;
  if (result === "anomaly") {
    return (
      <Badge variant="outline" className="border-amber-500 bg-amber-50 text-amber-900">
        anomaly
      </Badge>
    );
  }
  return <Badge variant="secondary">{result}</Badge>;
}

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId: encoded } = await params;
  const id = decodeURIComponent(encoded);

  const bundle = await getBatchByBatchId(id);
  if (!bundle) notFound();

  const { batch, verificationCount } = bundle;
  const logs = await listVerificationLogsForBatch(id, 200);

  const row = batch as Record<string, unknown>;
  const status = String(row.status ?? "");
  const nostrEventId = String(row.nostr_event_id ?? row.nostrEventId ?? "—");

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        href="/batches"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-2 text-muted-foreground")}
      >
        <ArrowLeft className="size-4" />
        All batches
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono tracking-tight text-green-800">{id}</CardTitle>
          <CardDescription>Manufacturer record and aggregated verification footprint.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Drug</p>
            <p className="text-sm">{String(row.drug_name ?? row.drugName ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Manufacturer</p>
            <p className="text-sm">{String(row.manufacturer ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Manufactured</p>
            <p className="text-sm">{String(row.manufacture_date ?? row.manufactureDate ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Expires</p>
            <p className="text-sm">{String(row.expiry_date ?? row.expiryDate ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <div className="mt-1">
              {status === "registered" ? (
                <Badge className="bg-green-600 hover:bg-green-700">registered</Badge>
              ) : (
                <Badge variant="outline">{status.replace(/_/g, " ") || "—"}</Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total verification checks</p>
            <p className="text-2xl font-semibold text-green-800 tabular-nums">{verificationCount}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Nostr event</p>
            <code className="mt-1 block whitespace-pre-wrap break-all rounded-lg border bg-muted/30 p-2 text-xs">
              {!nostrEventId || nostrEventId === "null" ? "—" : nostrEventId}
            </code>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="text-sm">{fmtTime(row.created_at ?? row.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification history</CardTitle>
          <CardDescription>Recent consumer lookups (includes WhatsApp and API).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No verification attempts logged for this batch yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, idx) => {
                  const lg = log as Record<string, unknown>;
                  const result = String(lg.result ?? "");
                  const phone =
                    typeof lg.user_phone === "string" && lg.user_phone ? lg.user_phone : "—";
                  const region = typeof lg.region === "string" && lg.region ? lg.region : "—";
                  return (
                    <TableRow key={String(lg.id ?? idx)}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtTime(lg.queried_at)}
                      </TableCell>
                      <TableCell>{pillForResult(result)}</TableCell>
                      <TableCell className="text-xs">{region}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{phone}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
