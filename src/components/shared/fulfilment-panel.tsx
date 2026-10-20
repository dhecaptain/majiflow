"use client";

import { useState, type FormEvent } from "react";
import { Bike, Check, Copy, PackageCheck, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { orderAction, type OrderActionInput } from "@/lib/orders";
import { allowedTransitions, isTerminalStatus } from "@/lib/order-status";
import { formatKES, formatPhone } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

type Mode = "idle" | "rider" | "reject" | "cancel";

const SUCCESS_NOTE: Partial<Record<OrderStatus, string>> = {
  accepted: "Order accepted - the customer has been told.",
  preparing: "Marked as preparing.",
  rider_assigned: "Rider assigned - share the delivery link with them.",
  out_for_delivery: "Dispatched - the customer can follow the delivery.",
  delivered: "Marked delivered.",
  rejected: "Order rejected.",
  cancelled: "Order cancelled.",
};

const PRIMARY_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: "Accept order",
  preparing: "Start preparing",
  out_for_delivery: "Dispatch with rider",
  delivered: "Mark delivered",
};

function refundLine(order: Order): string | null {
  const refund = order.refund;
  if (!refund) return null;
  if (refund.status === "confirmed") return `Refund of ${formatKES(refund.amount)} confirmed.`;
  if (refund.status === "failed") return refund.error ?? "The refund could not be opened automatically - support will follow up.";
  return `Refund of ${formatKES(refund.amount)} handed to payments - awaiting confirmation.`;
}

/**
 * Station/admin fulfilment controls for one order. Only shows the moves the
 * lifecycle allows for this actor; the server re-checks every one of them.
 */
export function FulfilmentPanel({
  order,
  actor,
  onChange,
}: {
  order: Order;
  actor: "station" | "admin";
  onChange: (order: Order) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [riderLink, setRiderLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [riderName, setRiderName] = useState(order.rider?.name ?? "");
  const [riderPhone, setRiderPhone] = useState(order.rider?.phone ?? "");
  const [reason, setReason] = useState("");

  const moves = allowedTransitions(order.status, actor);
  const primary = moves.find((s) => s in PRIMARY_LABEL);
  const unpaid = order.paymentState !== "success";
  const acceptBlocked = primary === "accepted" && unpaid;

  const run = async (input: OrderActionInput) => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setNote(null);
    const result = await orderAction(order.id, input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fields ?? {});
      return;
    }
    onChange(result.order);
    setMode("idle");
    setReason("");
    if (input.status) setNote(SUCCESS_NOTE[input.status] ?? "Order updated.");
    if (result.riderLink) {
      setRiderLink(`${window.location.origin}${result.riderLink}`);
      setCopied(false);
    } else if (input.status && input.status !== "rider_assigned") {
      setRiderLink(null);
    }
  };

  const submitRider = (event: FormEvent) => {
    event.preventDefault();
    void run({ status: "rider_assigned", rider: { name: riderName.trim(), phone: riderPhone.trim() } });
  };

  const submitClose = (event: FormEvent) => {
    event.preventDefault();
    void run({ status: mode === "reject" ? "rejected" : "cancelled", reason: reason.trim() || undefined });
  };

  const copyLink = async () => {
    if (!riderLink) return;
    try {
      await navigator.clipboard.writeText(riderLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const refund = refundLine(order);

  return (
    <section aria-labelledby="fulfilment-heading" className="rounded-2xl border border-border bg-white p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fulfilment-heading" className="font-display text-lg text-foreground">
          Fulfilment
        </h2>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.rider && !isTerminalStatus(order.status) && (
        <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <Bike className="size-4 text-[#0052FF]" aria-hidden />
          Rider: <span className="font-semibold">{order.rider.name}</span> · {formatPhone(order.rider.phone)}
        </p>
      )}

      {order.closedReason && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Reason:</span> {order.closedReason}
        </p>
      )}
      {refund && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {refund}
        </p>
      )}

      {note && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <Check className="size-4" aria-hidden /> {note}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {riderLink && (
        <div className="mt-4 rounded-xl border border-[#0052FF]/25 bg-[#0052FF]/5 p-4">
          <p className="text-sm font-semibold text-foreground">Rider delivery link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Send this to the rider. It is shown once and stops working when the order closes or the rider changes.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={riderLink} aria-label="Rider delivery link" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" onClick={() => void copyLink()} className="shrink-0 gap-2">
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {moves.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {order.status === "delivered"
            ? "Completed. Nothing left to do."
            : "Closed. The customer has been told and any payment is being returned."}
        </p>
      ) : mode === "rider" ? (
        <form onSubmit={submitRider} className="mt-4 space-y-3" noValidate>
          <Field label="Rider name" required error={fieldErrors.riderName}>
            <Input
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              autoComplete="off"
              invalid={Boolean(fieldErrors.riderName)}
            />
          </Field>
          <Field label="Rider phone" required error={fieldErrors.riderPhone} hint="Shared with the customer so they can reach the rider.">
            <Input
              value={riderPhone}
              onChange={(e) => setRiderPhone(e.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder="07XX XXX XXX"
              invalid={Boolean(fieldErrors.riderPhone)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {order.rider ? "Change rider" : "Assign rider"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              Back
            </Button>
          </div>
        </form>
      ) : mode === "reject" || mode === "cancel" ? (
        <form onSubmit={submitClose} className="mt-4 space-y-3">
          <Field label={mode === "reject" ? "Why are you rejecting it?" : "Why is it being cancelled?"} hint="The customer sees this. Optional.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </Field>
          {order.paymentState === "success" && (
            <p className="text-xs text-muted-foreground">The {formatKES(order.total)} payment is returned to the customer automatically.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={busy}>
              {mode === "reject" ? "Reject order" : "Cancel order"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          {acceptBlocked && (
            <p className="text-sm text-warning">Waiting for M-Pesa to confirm payment before this order can be accepted.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {primary && (
              <Button onClick={() => void run({ status: primary })} disabled={busy || acceptBlocked} className="gap-2">
                {primary === "delivered" ? (
                  <PackageCheck className="size-4" aria-hidden />
                ) : primary === "out_for_delivery" ? (
                  <Truck className="size-4" aria-hidden />
                ) : null}
                {PRIMARY_LABEL[primary]}
              </Button>
            )}
            {moves.includes("rider_assigned") && (
              <Button onClick={() => setMode("rider")} disabled={busy} className="gap-2">
                <Bike className="size-4" aria-hidden /> Assign rider
              </Button>
            )}
            {order.status === "rider_assigned" && (
              <>
                <Button variant="secondary" onClick={() => setMode("rider")} disabled={busy}>
                  Change rider
                </Button>
                <Button variant="ghost" onClick={() => void run({ status: "preparing" })} disabled={busy}>
                  Release rider
                </Button>
              </>
            )}
            {moves.includes("rejected") && (
              <Button variant="secondary" onClick={() => setMode("reject")} disabled={busy} className="gap-2">
                <XCircle className="size-4" aria-hidden /> Reject
              </Button>
            )}
            {moves.includes("cancelled") && (
              <Button variant="ghost" onClick={() => setMode("cancel")} disabled={busy}>
                Cancel order
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
