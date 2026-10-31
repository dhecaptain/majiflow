"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Inbox, MapPin, Phone, RefreshCw, Truck, X } from "lucide-react";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { useBusiness } from "@/components/business/business-provider";
import { fetchOrdersResult, orderAction } from "@/lib/orders";
import { isTerminalStatus } from "@/lib/order-status";
import { formatKES, formatPhone, formatRelativeTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "all" | OrderStatus;

const TAB_DEFS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "rider_assigned", label: "Rider assigned" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

type Row = {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  area: string;
  items: string;
  total: number;
  status: OrderStatus;
  paid: boolean;
  time: string;
  min: string;
};

function toRow(o: Order): Row {
  return {
    id: o.id,
    orderNumber: `#${o.orderNumber}`,
    customer: o.customerName,
    phone: o.customerPhone,
    area: [...new Set([o.address.street, o.address.estate, o.address.building].filter(Boolean))].join(", "),
    items: o.items.map((i) => `${i.quantity} × ${i.name}`).join(", "),
    total: o.total,
    status: o.status,
    paid: o.paymentState === "success",
    time: new Date(o.placedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
    min: formatRelativeTime(o.placedAt),
  };
}

type Load = "loading" | "ready" | "error";

/** One-tap next step from the list; the rider hand-off needs the detail page. */
const QUICK_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; note: string }>> = {
  pending: { to: "accepted", label: "Accept", note: "Order accepted - the customer has been told." },
  accepted: { to: "preparing", label: "Start preparing", note: "Marked as preparing." },
  rider_assigned: { to: "out_for_delivery", label: "Dispatch", note: "Dispatched - the customer can follow it." },
  out_for_delivery: { to: "delivered", label: "Mark delivered", note: "Marked delivered." },
};

export function BusinessOrders() {
  const { business } = useBusiness();
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const result = await fetchOrdersResult({ businessId: business.id });
      if (!alive) return;
      if (result.ok) {
        setRows(result.orders.map(toRow));
        setLoad("ready");
      } else {
        // Keep showing the last good list during a blip; only a first-load failure is an error screen.
        setLoad((current) => (current === "ready" ? current : "error"));
      }
    };
    void tick();
    const poll = window.setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [business.id, reloadKey]);

  const TABS = useMemo(
    () =>
      TAB_DEFS.map((t) => ({
        ...t,
        count: t.id === "all" ? rows.length : rows.filter((r) => r.status === t.id).length,
      })),
    [rows]
  );

  const filtered = useMemo(() => (tab === "all" ? rows : rows.filter((r) => r.status === tab)), [rows, tab]);

  const applyStatus = async (id: string, status: OrderStatus, message: string) => {
    setBusyId(id);
    setError(null);
    const result = await orderAction(id, { status });
    setBusyId(null);
    if (!result.ok) {
      setNote(null);
      setError(result.error);
      return;
    }
    setRows((all) => all.map((r) => (r.id === id ? toRow(result.order) : r)));
    setNote(message);
  };

  const advance = (row: Row) => {
    const step = QUICK_STEP[row.status];
    if (step) void applyStatus(row.id, step.to, step.note);
  };

  const reject = (row: Row) => {
    void applyStatus(
      row.id,
      "rejected",
      row.paid ? "Order rejected - the customer's payment is being returned." : "Order rejected."
    );
  };

  if (load === "loading") {
    return (
      <div className="py-10">
        <LoadingState label="Loading orders…" />
      </div>
    );
  }

  if (load === "error") {
    return (
      <div className="py-10">
        <ErrorState
          title="Orders could not be loaded"
          message="Check your connection, or sign in again if your session expired."
          action={
            <Button
              onClick={() => {
                setLoad("loading");
                setReloadKey((k) => k + 1);
              }}
              className="gap-2"
            >
              <RefreshCw className="size-4" aria-hidden /> Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} shown · accept once M-Pesa confirms, then prepare, assign a rider and dispatch.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {note && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">
          <span className="flex items-center gap-2">
            <Check className="size-4" aria-hidden /> {note}
          </span>
          <button onClick={() => setNote(null)} aria-label="Dismiss" className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[var(--brand)] bg-brand/10 text-[var(--brand)]"
                : "border-border bg-white text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={tab === t.id}
          >
            {t.label}
            <span className={cn("ml-2 font-mono text-xs", tab === t.id ? "text-[var(--brand)]" : "text-muted-foreground")}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" aria-hidden />}
            title={rows.length === 0 ? "No orders yet" : "Nothing here right now"}
            description={
              rows.length === 0
                ? "New orders appear here as soon as customers check out."
                : "No orders are in this state at the moment."
            }
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-muted/30">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-sm text-foreground">
                    {o.customer.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {o.customer}
                      <Link
                        href={`/business/orders/${o.id}`}
                        className="ml-2 font-mono text-xs font-normal text-muted-foreground hover:text-[var(--brand)] hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden /> {o.area}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" aria-hidden /> {formatPhone(o.phone)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="size-3" aria-hidden /> {o.min}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-xs text-foreground/75">{o.items}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="hidden text-right font-display text-base text-foreground sm:block">{formatKES(o.total)}</span>
                  {o.status === "pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reject(o)}
                      disabled={busyId === o.id}
                      aria-label={`Reject order ${o.orderNumber}`}
                    >
                      <X className="size-3.5" aria-hidden /> Reject
                    </Button>
                  )}
                  {o.status === "pending" && !o.paid ? (
                    <span className="text-xs text-warning" title="Accept once M-Pesa confirms the payment">
                      Awaiting payment
                    </span>
                  ) : QUICK_STEP[o.status] ? (
                    <Button
                      size="sm"
                      variant={o.status === "pending" ? "default" : "secondary"}
                      onClick={() => advance(o)}
                      disabled={busyId === o.id}
                      aria-label={`${QUICK_STEP[o.status]!.label} for order ${o.orderNumber}`}
                    >
                      {QUICK_STEP[o.status]!.label}
                    </Button>
                  ) : o.status === "preparing" ? (
                    <Link
                      href={`/business/orders/${o.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Assign rider
                    </Link>
                  ) : null}
                  {isTerminalStatus(o.status) && <OrderStatusBadge status={o.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
