"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BatchRow = {
  batch_id?: string;
  batchId?: string;
  drug_name?: string;
  drugName?: string;
  manufacturer?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  verification_count?: number;
};

function pick(r: BatchRow): {
  bid: string;
  drug: string;
  manufacturer: string;
  status: string;
  created: Date | null;
  verifications: number;
} {
  const bid = String(r.batch_id ?? r.batchId ?? "");
  const createdRaw = String(r.created_at ?? r.createdAt ?? "");
  const created = createdRaw ? new Date(createdRaw) : null;
  return {
    bid,
    drug: String(r.drug_name ?? r.drugName ?? "—"),
    manufacturer: String(r.manufacturer ?? "—"),
    status: String(r.status ?? ""),
    created: created && !Number.isNaN(created.getTime()) ? created : null,
    verifications: typeof r.verification_count === "number" ? r.verification_count : 0,
  };
}

export function BatchTable({ rows }: { rows: unknown[] }) {
  const normalized = rows.map((x) => pick((typeof x === "object" && x ? x : {}) as BatchRow));

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"batch" | "drug" | "created" | "verifies">("created");

  const filtered = useMemo(() => {
    const list =
      statusFilter === "all" ? [...normalized] : normalized.filter((r) => r.status === statusFilter);
    list.sort((a, b) => {
      switch (sortKey) {
        case "batch":
          return a.bid.localeCompare(b.bid);
        case "drug":
          return a.drug.localeCompare(b.drug);
        case "verifies":
          return b.verifications - a.verifications;
        default: {
          const ta = a.created?.getTime() ?? 0;
          const tb = b.created?.getTime() ?? 0;
          return tb - ta;
        }
      }
    });
    return list;
  }, [normalized, statusFilter, sortKey]);

  function formatDate(d: Date | null) {
    if (!d) return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
  }

  function statusBadge(s: string) {
    if (s === "registered") return <Badge className="bg-green-600 hover:bg-green-600">registered</Badge>;
    if (s === "pending_payment") return <Badge variant="outline">pending payment</Badge>;
    return <Badge variant="secondary">{s || "?"}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="batch-filter">Filter by status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "all")}
          >
            <SelectTrigger id="batch-filter" className="w-full sm:w-[220px]" size="default">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="pending_payment">Pending payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="batch-sort">Sort by</Label>
          <Select value={sortKey} onValueChange={(v) => setSortKey((v ?? "created") as typeof sortKey)}>
            <SelectTrigger id="batch-sort" className="w-full sm:w-[220px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Newest registration</SelectItem>
              <SelectItem value="batch">Batch ID (A→Z)</SelectItem>
              <SelectItem value="drug">Drug name</SelectItem>
              <SelectItem value="verifies">Verification count</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground pb-2 sm:ml-auto">{filtered.length} shown</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch ID</TableHead>
            <TableHead>Drug</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead className="text-center">Checks</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => {
            const detailHref = `/batches/${encodeURIComponent(row.bid)}`;
            return (
              <TableRow key={row.bid}>
                <TableCell className="font-mono font-medium">
                  <Link href={detailHref} className="text-green-700 hover:underline">
                    {row.bid}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{row.drug}</TableCell>
                <TableCell className="max-w-[160px] truncate">{row.manufacturer}</TableCell>
                <TableCell className="text-center tabular-nums">{row.verifications}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                  {formatDate(row.created)}
                </TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
                <TableCell>
                  <Link
                    href={detailHref}
                    className="text-muted-foreground hover:text-green-700"
                    aria-label={`Batch ${row.bid} details`}
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6 border rounded-xl">
          No batches match this filter.
        </p>
      ) : null}
    </div>
  );
}
