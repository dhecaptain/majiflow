"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Boxes, CheckCircle2, Package, RefreshCw, Repeat, TrendingUp, Users } from "lucide-react";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { ButtonLoader } from "@/components/ui/button-loader";
import { formatKES } from "@/lib/format";
import { percentChange, resolveDateRange, summarizeStation } from "@/lib/analytics";
import { useBusiness } from "@/components/business/business-provider";
import { useStationOrders } from "@/lib/use-station-orders";
import { orderAction } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export function DashboardOverview() {
  const { business } = useBusiness();
  const { orders, stats, loading, delayed, error, refresh } = useStationOrders(business, "7d");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Today's totals come from the station-local day, not the 7 day window. */
  const today = useMemo(
    () => (orders ? summarizeStation(business, orders, resolveDateRange("today")) : null),
    [business, orders]
  );

  const recent = useMemo(() => (orders ? orders.slice(0, 6) : []), [orders]);
  const maxRevenue = useMemo(() => Math.max(1, ...(stats?.buckets.map((b) => b.revenue) ?? [1])), [stats]);
  const maxProduct = useMemo(() => Math.max(1, ...(stats?.topProducts.map((p) => p.revenue) ?? [1])), [stats]);

  const accept = async (order: Order) => {
    setBusyId(order.id);
    setActionError(null);
    const result = await orderAction(order.id, { status: "accepted" });
    setBusyId(null);
    if (result.ok) refresh();
    else setActionError(result.error);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header business={business.name} />
        <LoadingState label="Loading your station's numbers…" />
      </div>
    );
  }

  if (error || !stats || !today) {
    return (
      <div className="space-y-6">
        <Header business={business.name} />
        <ErrorState
          title="Could not load your station"
          message="The order store did not answer, so these numbers cannot be trusted. Nothing is wrong with your data."
          action={
            <Button onClick={refresh}>
              <RefreshCw className="size-4" aria-hidden /> Try again
            </Button>
          }
        />
      </div>
    );
  }

  const hasOrders = stats.orderCount > 0;

  return (
    <div className="space-y-6">
      <Header business={business.name} delayed={delayed} />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Revenue today"
          value={formatKES(today.revenue)}
          delta={deltaLabel(today.revenue, today.previous?.revenue ?? null)}
          positive={(today.previous?.revenue ?? 0) > 0 && today.revenue > (today.previous?.revenue ?? 0)}
          hint={
            today.previous
              ? `vs ${formatKES(today.previous.revenue)} yesterday`
              : "First orders today - no yesterday to compare yet."
          }
        />
        <KpiCard
          icon={Package}
          label="Orders today"
          value={String(today.orderCount)}
          delta={`${today.statusCounts.pending} need attention`}
          hint={`${today.statusCounts.accepted + today.statusCounts.preparing + today.statusCounts.rider_assigned} in preparation, ${today.statusCounts.out_for_delivery} out`}
        />
        <KpiCard
          icon={Boxes}
          label="Out for delivery"
          value={String(stats.statusCounts.out_for_delivery)}
          delta={`${stats.activeCount} live right now`}
          hint="Live while the customer shares location"
        />
        <KpiCard
          icon={Repeat}
          label="Repeat customers"
          value={`${stats.repeatRate}%`}
          delta={`${stats.customers.length} on record`}
          hint="Last 7 days, share of ordering customers who have ordered before"
        />
      </div>

      {!hasOrders && (
        <EmptyState
          icon={<Package className="size-6" aria-hidden />}
          title="No orders in the last 7 days"
          description="Once a customer checks out on your public page, their order shows up here within a second."
          action={
            <Link href={`/browse/${business.slug}`}>
              <Button variant="secondary">View your public page</Button>
            </Link>
          }
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Chart */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-foreground">Revenue, last 7 days</h2>
              <p className="text-sm text-muted-foreground">Goods subtotal · M-Pesa and card orders</p>
            </div>
            <Link href="/business/analytics">
              <Button variant="secondary" size="sm" className="group gap-1.5">
                Analytics
              </Button>
            </Link>
          </div>
          {stats.buckets.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No revenue to chart yet.</p>
          ) : (
            <div className="mt-8 flex h-44 items-end gap-3 sm:gap-4">
              {stats.buckets.map((c) => (
                <div key={c.key} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-foreground/80 transition-colors group-hover:bg-foreground"
                      style={{ height: `${(c.revenue / maxRevenue) * 100}%` }}
                      title={formatKES(c.revenue)}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {formatKES(c.revenue)}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stock alerts */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <AlertTriangle className="size-5 text-foreground" aria-hidden /> Stock alerts
            </h2>
            <Link href="/business/products">
              <Button variant="secondary" size="sm" className="group gap-1.5">
                Manage
              </Button>
            </Link>
          </div>
          {stats.stockAlerts.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Every product on your menu is above its reorder point.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {stats.stockAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.stock} {a.unit} left · reorder at {a.threshold}
                    </p>
                  </div>
                  <div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", a.stock / Math.max(1, a.threshold) < 0.6 ? "bg-danger" : "bg-foreground")}
                      style={{ width: `${Math.min(100, (a.stock / Math.max(1, a.threshold)) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Recent orders */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <h2 className="font-display text-lg text-foreground">Latest orders</h2>
            <Link href="/business/orders">
              <Button variant="secondary" size="sm" className="group gap-1.5">
                All orders
              </Button>
            </Link>
          </div>
          {actionError && (
            <p role="alert" className="border-b border-border bg-danger/5 px-6 py-3 text-sm text-danger">
              {actionError}
            </p>
          )}
          {recent.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nothing here yet. Orders arrive the moment a customer checks out.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted font-display text-sm text-foreground">
                      {o.customerName.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{o.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.orderNumber} · {[o.address.street, o.address.estate].filter(Boolean).join(", ") || o.address.estate} ·{" "}
                        {o.items.length} {o.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-base text-foreground">{formatKES(o.total)}</span>
                    {o.status === "pending" && o.paymentState !== "success" ? (
                      <span className="text-xs text-warning">Awaiting payment</span>
                    ) : o.status === "pending" ? (
                      <Button size="sm" onClick={() => void accept(o)} disabled={busyId === o.id}>
                        {busyId === o.id ? "Accepting…" : "Accept"}
                      </Button>
                    ) : (
                      <OrderStatusBadge status={o.status} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Best sellers */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <BadgeCheck className="size-5 text-foreground" aria-hidden /> Best sellers
            </h2>
            <Link href="/business/analytics">
              <Button variant="secondary" size="sm" className="group gap-1.5">
                Analytics
              </Button>
            </Link>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No products sold in this window.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {stats.topProducts.slice(0, 5).map((p, i) => (
                <li key={p.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="font-semibold text-foreground">{formatKES(p.revenue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${(p.revenue / maxProduct) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.quantity} sold</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-muted/50 p-4">
            <Users className="mt-0.5 size-4.5 shrink-0 text-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">
                {stats.customers.filter((c) => c.status === "dormant").length} dormant customers
              </strong>{" "}
              have not ordered in over 30 days.
            </p>
          </div>
        </section>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-foreground" aria-hidden />
        Live totals from this station&apos;s orders · {stats.orderCount} in the last 7 days
      </p>
    </div>
  );
}

function Header({ business, delayed }: { business: string; delayed?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl text-foreground sm:text-3xl">Station overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })} · how{" "}
          {business} is doing
        </p>
      </div>
      {delayed && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-warning/25 bg-muted px-3 py-2 text-xs text-foreground/80">
          <ButtonLoader className="size-3.5 text-[var(--brand)]" /> Still loading - the store is taking
          longer than usual.
        </p>
      )}
    </div>
  );
}

/** A percentage only when there is a real baseline; otherwise a fact. */
function deltaLabel(current: number, baseline: number | null): string {
  if (baseline === null) return "no baseline";
  const change = percentChange(current, baseline);
  if (change === null) return "nothing yesterday";
  return `${change > 0 ? "+" : ""}${change}%`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  positive,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-cta-soft text-[var(--brand)]">
          <Icon className="size-4.5" aria-hidden />
        </span>
        {positive && (
          <span className="flex items-center gap-1 text-xs font-semibold text-success">
            <ArrowUpRight className="size-3.5" aria-hidden /> {delta}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
        {!positive && <ArrowDownRight className="size-3 text-muted-foreground" aria-hidden />}
        {delta}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}
