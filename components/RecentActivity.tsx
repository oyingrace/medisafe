import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatTs(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }
  if (typeof value !== "string") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function RecentActivity({
  verificationRows,
  batchRows,
}: {
  verificationRows: Array<Record<string, unknown>>;
  batchRows: Array<Record<string, unknown>>;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent verifications</CardTitle>
          <CardDescription>Latest consumer WhatsApp/API checks logged in your database.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {verificationRows.length === 0 ? (
              <li className="text-muted-foreground">No verification activity yet.</li>
            ) : (
              verificationRows.map((row, idx) => {
                const bid = String(row.batch_id ?? "");
                const result = String(row.result ?? "");
                const href = `/batches/${encodeURIComponent(bid)}`;
                return (
                  <li
                    key={String(row.id ?? idx)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link href={href} className="font-medium text-green-700 hover:underline truncate block">
                        {bid || "(unknown)"}
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatTs(row.queried_at)}</span>
                      {typeof row.region === "string" && row.region ? (
                        <span className="ml-2 text-xs text-muted-foreground">• {row.region}</span>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        result === "verified"
                          ? "border-green-500 bg-green-50 text-green-800"
                          : result === "anomaly"
                            ? "border-amber-500 bg-amber-50 text-amber-900"
                            : result === "fake"
                              ? "border-red-300 bg-red-50 text-red-800"
                              : ""
                      }
                    >
                      {result}
                    </Badge>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent batch activity</CardTitle>
          <CardDescription>New registrations and pending Lightning payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {batchRows.length === 0 ? (
              <li className="text-muted-foreground">No batches registered yet.</li>
            ) : (
              batchRows.map((row, idx) => {
                const bid = String(row.batch_id ?? "");
                const status = String(row.status ?? "");
                const href = `/batches/${encodeURIComponent(bid)}`;
                return (
                  <li
                    key={`${bid}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link href={href} className="font-medium text-green-700 hover:underline truncate block">
                        {bid}
                      </Link>
                      <span className="text-xs text-muted-foreground truncate block">
                        {String(row.drug_name ?? "")}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatTs(row.created_at)}</span>
                    </div>
                    <Badge
                      variant={status === "registered" ? "default" : "secondary"}
                      className={
                        status === "registered"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : ""
                      }
                    >
                      {status.replace(/_/g, " ")}
                    </Badge>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
