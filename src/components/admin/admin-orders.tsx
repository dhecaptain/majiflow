"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Phone, Radio, Truck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { fetchOrdersResult } from "@/lib/orders";
import { isActiveStatus } from "@/lib/order-status";
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

/**
 * Platform-wide live order feed for the MajiFlow owner: every station's
 * orders in one stream, with links into the shared tracking view.
 */
export function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const result = await fetchOrdersResult();
      if (!alive) return;
      if (result.ok) {
        setOrders(result.orders);
        setFailed(false);
      } else {
        setFailed(true);
      }
    };
    void tick();
    const poll = window.setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, []);

  const TABS = useMemo(
    () =>
      TAB_DEFS.map((t) => ({
        ...t,
        count: !orders ? 0 : t.id === "all" ? orders.length : orders.filter((o) => o.status === t.id).length,
      })),
    [orders]
  );

  const filtered = useMemo(() => {
    if (!orders) return null;
    return tab === "all" ? orders : orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const inFlight = orders?.filter((o) => isActiveStatus(o.status)).length ?? 0;

  return (
    <Container className="py-14 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--brand)]"
          >
            Control room
          </Link>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl text-foreground sm:text-4xl">
            Live orders
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-success">
              <Radio className="size-3 animate-pulse-dot" aria-hidden /> {inFlight} in flight
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every station&apos;s orders across Kenya - updating live. Open one to watch the customer&apos;s location.
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
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

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {!filtered && failed ? (
          <div className="p-10">
            <ErrorState
              title="Orders could not be loaded"
              message="The order store did not answer, or your admin session ended. Retrying automatically."
            />
          </div>
        ) : !filtered ? (
          <div className="p-10">
            <LoadingState label="Loading orders…" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No orders in this state right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-muted/30">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-sm text-foreground">
                    {o.customerName.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {o.customerName}
                      <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{o.orderNumber}</span>
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
                        {o.businessName}
                      </span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />{" "}
                        {[o.address.street, o.address.estate].filter(Boolean).join(", ") || o.address.estate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" aria-hidden /> {formatPhone(o.customerPhone)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" aria-hidden /> {formatRelativeTime(o.placedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="size-3" aria-hidden />{" "}
                        {o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-right font-display text-base text-foreground sm:block">
                    {formatKES(o.total)}
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand)]/30 bg-brand/5 px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-brand/10"
                    aria-label={`Track order ${o.orderNumber}`}
                  >
                    Track
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
