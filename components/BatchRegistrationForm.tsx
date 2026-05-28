"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentModal } from "@/components/PaymentModal";

const formSchema = z.object({
  batchId: z
    .string()
    .trim()
    .min(6, "Batch ID must be at least 6 characters")
    .max(24, "Batch ID must be 24 characters or fewer")
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and hyphens"),
  drugName: z.string().trim().min(2, "Drug name is required"),
  manufacturer: z.string().trim().min(2, "Manufacturer name is required"),
  manufactureDate: z.string().trim().min(4, "Manufacture date is required"),
  expiryDate: z.string().trim().min(4, "Expiry date is required"),
});

export function BatchRegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    batchId: "",
    drugName: "",
    manufacturer: "",
    manufactureDate: "",
    expiryDate: "",
  });
  const [invoice, setInvoice] = useState("");
  const [paymentHash, setPaymentHash] = useState("");
  const [invoiceType, setInvoiceType] = useState<"bolt11" | "spark">("bolt11");
  const [status, setStatus] = useState<"idle" | "pending" | "paid" | "failed">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [nostrEventId, setNostrEventId] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string" && !errs[path]) errs[path] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = parsed.data;
      const resp = await fetch("/api/register-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Failed to create invoice");
        return;
      }
      setInvoice(data.invoice);
      setPaymentHash(data.paymentHash);
      if (data.invoiceType === "spark") setInvoiceType("spark");
      else setInvoiceType("bolt11");
      setStatus("pending");
    } finally {
      setSubmitting(false);
    }
  }

  const checkStatus = useCallback(async () => {
    if (!paymentHash) return;
    const resp = await fetch(`/api/register-batch/confirm?paymentHash=${encodeURIComponent(paymentHash)}`);
    const data = (await resp.json()) as {
      success?: boolean;
      status?: "pending" | "paid" | "failed";
      nostrEventId?: string;
      error?: string;
      detail?: string;
    };
    if (!resp.ok) {
      setError(data.detail ?? data.error ?? "Could not confirm payment / publish to Nostr");
      setStatus("pending");
      return;
    }
    setError("");
    const newStatus = data.status ?? "pending";
    setStatus(newStatus);
    if (data.nostrEventId) setNostrEventId(data.nostrEventId);
    if (newStatus === "paid") {
      window.setTimeout(() => router.push("/batches"), 1500);
    }
  }, [paymentHash]);

  useEffect(() => {
    if (!paymentHash || status === "paid" || status === "failed") return;
    const immediate = window.setTimeout(() => {
      void checkStatus();
    }, 0);
    const timer = window.setInterval(() => {
      void checkStatus();
    }, 2000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [paymentHash, status, checkStatus]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Register batch</CardTitle>
          <CardDescription>
            We generate a payment invoice (Spark on regtest, BOLT11 on mainnet). After payment settles, MedSafe signs a Nostr event for this batch.
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="batchId">
                Batch ID <span className="text-muted-foreground font-normal">(required)</span>
              </Label>
              <Input
                id="batchId"
                name="batchId"
                placeholder="AMX500-2024-Q1"
                value={form.batchId}
                onChange={(e) => setForm((o) => ({ ...o, batchId: e.target.value.toUpperCase() }))}
                aria-invalid={Boolean(fieldErrors.batchId)}
              />
              {fieldErrors.batchId ? <p className="text-xs text-destructive">{fieldErrors.batchId}</p> : null}
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="drugName">Drug name</Label>
              <Input
                id="drugName"
                name="drugName"
                placeholder="Amoxicillin 500mg"
                value={form.drugName}
                onChange={(e) => setForm((o) => ({ ...o, drugName: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.drugName)}
              />
              {fieldErrors.drugName ? <p className="text-xs text-destructive">{fieldErrors.drugName}</p> : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                name="manufacturer"
                placeholder="e.g. Fidson Healthcare"
                value={form.manufacturer}
                onChange={(e) => setForm((o) => ({ ...o, manufacturer: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.manufacturer)}
              />
              {fieldErrors.manufacturer ? (
                <p className="text-xs text-destructive">{fieldErrors.manufacturer}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="manufactureDate">Manufacture date</Label>
              <Input
                id="manufactureDate"
                name="manufactureDate"
                type="date"
                value={form.manufactureDate}
                onChange={(e) => setForm((o) => ({ ...o, manufactureDate: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.manufactureDate)}
              />
              {fieldErrors.manufactureDate ? (
                <p className="text-xs text-destructive">{fieldErrors.manufactureDate}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="expiryDate">Expiry date</Label>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((o) => ({ ...o, expiryDate: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.expiryDate)}
              />
              {fieldErrors.expiryDate ? <p className="text-xs text-destructive">{fieldErrors.expiryDate}</p> : null}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-3 border-t pt-6">
            <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating invoice…
                </>
              ) : (
                "Create invoice"
              )}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {nostrEventId ? (
              <p className="text-sm font-medium text-green-700">
                Registered on Nostr — event id{" "}
                <code className="rounded bg-green-50 px-1 py-0.5 text-xs">{nostrEventId}</code>
              </p>
            ) : null}
          </CardFooter>
        </form>
      </Card>
      {invoice ? (
        <PaymentModal invoice={invoice} paymentHash={paymentHash} status={status} invoiceType={invoiceType} onCheckStatus={checkStatus} />
      ) : (
        <div className="hidden lg:block rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground leading-relaxed">
          After you submit, the Lightning invoice card will appear here with a QR code, copy invoice, and live payment
          status.
        </div>
      )}
    </div>
  );
}
