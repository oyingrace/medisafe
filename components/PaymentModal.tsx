"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PaymentModalProps {
  invoice: string;
  paymentHash: string;
  status: "idle" | "pending" | "paid" | "failed";
  onCheckStatus: () => void;
}

export function PaymentModal({ invoice, paymentHash, status, onCheckStatus }: PaymentModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const statusBadge =
    status === "paid" ? (
      <Badge className="bg-green-600 hover:bg-green-600">Paid</Badge>
    ) : status === "failed" ? (
      <Badge variant="destructive">Failed</Badge>
    ) : (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
        Awaiting payment
      </Badge>
    );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Lightning payment</CardTitle>
          <CardDescription>Demo flow auto-confirms after a few seconds, or retry “Refresh status”. </CardDescription>
        </div>
        {statusBadge}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-border">
          <QRCodeSVG value={invoice} size={184} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Invoice string</p>
          <code className="block max-h-32 overflow-auto rounded-lg border bg-muted/30 p-3 text-[11px] leading-snug break-all whitespace-pre-wrap">
            {invoice}
          </code>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void copyInvoice()}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy invoice"}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 border-t">
        <p className="text-xs text-muted-foreground">
          Payment hash: <span className="font-mono text-foreground">{paymentHash}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void onCheckStatus()} variant="secondary" size="sm">
            Refresh status
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
