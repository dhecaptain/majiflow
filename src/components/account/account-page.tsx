"use client";

import Link from "next/link";
import { Bell, Clock, MapPin, PackageCheck, Plus, Recycle, RotateCcw, Wallet } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useCustomer } from "@/components/order/customer-provider";
import { AccountError, itemsSummary, useAccountResource, useReorder } from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import { formatKES, formatRelativeTime } from "@/lib/format";
import type { Order } from "@/lib/types";

function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      href={`/account/orders/${order.id}`}
      className="block rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-layered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {order.orderNumber} · {order.businessName}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{itemsSummary(order)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <time dateTime={order.placedAt}>{formatRelativeTime(order.placedAt)}</time>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-foreground">{formatKES(order.total)}</p>
          <OrderStatusBadge status={order.status} className="mt-1" />
        </div>
      </div>
    </Link>
  );
}

export function AccountPage() {
  const { profile } = useCustomer();
  const { resource, reload } = useAccountResource("summary", accountApi.summary);
  const { reorder, pendingId } = useReorder();

  const firstName = (profile.name || "Customer").split(" ")[0];
  const summary = resource.status === "ready" ? resource.data : null;
  const lastOrder = summary?.recentOrders[0];

  const stats = summary
    ? [
        { icon: PackageCheck, label: "Active orders", value: String(summary.metrics.activeOrders) },
        { icon: Recycle, label: "Cans delivered", value: String(summary.metrics.cansDelivered) },
        { icon: Wallet, label: "Total paid", value: formatKES(summary.metrics.totalSpent) },
        { icon: Clock, label: "Orders placed", value: String(summary.metrics.ordersPlaced) },
      ]
    : [];

  return (
    <Container className="py-6 lg:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-success">
              <span aria-hidden className="size-1.5 rounded-full bg-success animate-pulse-dot" /> Signed in
            </p>
            <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">Habari, {firstName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.phone && <span className="font-medium text-foreground">{profile.phone} · </span>}
              Manage your refills from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary && summary.unreadNotifications > 0 && (
              <Link href="/account/notifications">
                <Button variant="secondary" aria-label={`${summary.unreadNotifications} unread notifications`}>
                  <Bell className="size-4" aria-hidden />
                  <Badge variant="accent">{summary.unreadNotifications}</Badge>
                </Button>
              </Link>
            )}
            <Link href="/browse">
              <Button>Order water</Button>
            </Link>
          </div>
        </div>
      </section>

      {resource.status === "error" ? (
        <div className="mt-6">
          <AccountError message={resource.error} code={resource.code} onRetry={reload} />
        </div>
      ) : (
        <>
          <section aria-label="Account summary" aria-busy={!summary} className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {summary
              ? stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-[var(--brand)]">
                      <s.icon className="size-4.5" aria-hidden />
                    </span>
                    <p className="mt-3 font-display text-2xl text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => <SkeletonCard key={i} variant="metric" />)}
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-8">
              {summary && summary.activeOrders.length > 0 && (
                <section aria-labelledby="active-orders">
                  <h2 id="active-orders" className="font-display text-xl text-foreground">
                    On the way
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {summary.activeOrders.map((o) => (
                      <li key={o.id}>
                        <OrderRow order={o} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="recent-orders">
                <div className="flex items-center justify-between">
                  <h2 id="recent-orders" className="font-display text-xl text-foreground">
                    Recent orders
                  </h2>
                  <Link href="/account/orders">
                    <Button variant="secondary" size="sm">View all</Button>
                  </Link>
                </div>
                {!summary ? (
                  <div className="mt-4 space-y-3" role="status" aria-label="Loading orders">
                    {[1, 2].map((i) => (
                      <SkeletonCard key={i} variant="row" />
                    ))}
                  </div>
                ) : summary.recentOrders.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={<PackageCheck className="size-7" aria-hidden />}
                      title="No orders yet"
                      description="Once you place your first order it shows up here with live tracking."
                      action={
                        <Link href="/browse">
                          <Button>Find your station</Button>
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {summary.recentOrders.map((o) => (
                      <li key={o.id}>
                        <OrderRow order={o} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section aria-labelledby="saved-addresses">
              <div className="flex items-center justify-between">
                <h2 id="saved-addresses" className="font-display text-xl text-foreground">
                  Saved addresses
                </h2>
                <Link href="/account/addresses">
                  <Button variant="secondary" size="sm">Manage</Button>
                </Link>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {!summary ? (
                  <SkeletonCard variant="row" />
                ) : summary.addresses.length === 0 ? (
                  <Link
                    href="/account/addresses"
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-white p-8 text-center transition-colors hover:border-[var(--brand)]/40"
                  >
                    <Plus className="size-6 text-[var(--brand)]" aria-hidden />
                    <p className="text-sm font-medium text-muted-foreground">No saved addresses yet</p>
                    <p className="text-xs text-muted-foreground/70">Save your estate and building for one-tap reordering.</p>
                  </Link>
                ) : (
                  <>
                    {summary.addresses.map((a) => (
                      <div key={a.id} className="rounded-2xl border border-border bg-white p-5 shadow-card">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-[var(--brand)]" aria-hidden />
                          <p className="text-sm font-semibold text-foreground">
                            {a.label} · {a.estate}
                            {a.building && <span className="font-normal text-muted-foreground"> · {a.building}</span>}
                          </p>
                          {a.isDefault && <Badge variant="success">Default</Badge>}
                        </div>
                        {a.floor && <p className="mt-1 text-xs text-muted-foreground">{a.floor}</p>}
                      </div>
                    ))}
                    {summary.addressCount > summary.addresses.length && (
                      <p className="text-xs text-muted-foreground">
                        +{summary.addressCount - summary.addresses.length} more saved
                      </p>
                    )}
                  </>
                )}
              </div>

              {lastOrder && (
                <div className="mt-6 rounded-2xl border border-[var(--brand)]/20 bg-brand/5 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--brand)]">Quick reorder</p>
                  <p className="mt-1.5 text-sm text-foreground/85">
                    Your last order was <strong className="font-semibold">{itemsSummary(lastOrder)}</strong> from{" "}
                    {lastOrder.businessName}.
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    className="mt-3"
                    disabled={pendingId === lastOrder.id}
                    aria-busy={pendingId === lastOrder.id}
                    onClick={() => reorder(lastOrder.id)}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {pendingId === lastOrder.id ? "Adding to cart…" : "Reorder"}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </Container>
  );
}
