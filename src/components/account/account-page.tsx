"use client";

import Link from "next/link";
import { Bell, Clock, MapPin, PackageCheck, Plus, Recycle, RotateCcw, Wallet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useCustomer } from "@/components/order/customer-provider";
import { ACCOUNT_PAGE, AccountError, CustomerStatusPill, itemsSummary, OrderProgress, useAccountResource, useReorder } from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import { formatKES, formatRelativeTime } from "@/lib/format";
import type { Order } from "@/lib/types";
import { ACTIVE_STATUSES } from "@/lib/account";
import { cn } from "@/lib/utils";

function OrderRow({ order }: { order: Order }) {
  const active = ACTIVE_STATUSES.includes(order.status);
  return (
    <Link
      href={`/account/orders/${order.id}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-white p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        active ? "border-2 border-[var(--brand)]" : "border border-border"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{order.businessName}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {order.orderNumber} · <time dateTime={order.placedAt}>{formatRelativeTime(order.placedAt)}</time> ·{" "}
            {formatKES(order.total)}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{itemsSummary(order)}</p>
        </div>
        <CustomerStatusPill status={order.status} />
      </div>
      {active && <OrderProgress status={order.status} />}
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
    <div className={ACCOUNT_PAGE}>
      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-soft px-2.5 text-xs font-bold text-success">
              <span aria-hidden className="size-1.5 rounded-full bg-success animate-pulse-dot" /> Signed in
            </p>
            <h1 className="mt-2 font-display text-[28px] font-bold leading-tight text-foreground sm:text-4xl">Habari, {firstName}</h1>
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
            <Link
              href="/browse"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
            >
              Order water
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
          <section aria-label="Account summary" aria-busy={!summary} className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary
              ? stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-white p-4 sm:p-5 sm:p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-[var(--brand)]">
                      <s.icon className="size-4.5" aria-hidden />
                    </span>
                    <p className="mt-3 text-[22px] font-extrabold leading-tight text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => <SkeletonCard key={i} variant="metric" />)}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:gap-8">
            <div className="space-y-6">
              {summary && summary.activeOrders.length > 0 && (
                <section aria-labelledby="active-orders">
                  <h2 id="active-orders" className="text-[15px] font-extrabold text-foreground">
                    On the way
                  </h2>
                  <ul className="mt-3 flex flex-col gap-3">
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
                  <h2 id="recent-orders" className="text-[15px] font-extrabold text-foreground">
                    Recent orders
                  </h2>
                  <Link href="/account/orders" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--brand)] hover:text-brand-deep">View all</Link>
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
                        <Link href="/browse" className={buttonVariants()}>Find your station</Link>
                      }
                    />
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
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
                <h2 id="saved-addresses" className="text-[15px] font-extrabold text-foreground">
                  Saved addresses
                </h2>
                <Link href="/account/addresses" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--brand)] hover:text-brand-deep">Manage</Link>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {!summary ? (
                  <SkeletonCard variant="row" />
                ) : summary.addresses.length === 0 ? (
                  <Link
                    href="/account/addresses"
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white p-6 text-center transition-colors hover:border-[var(--brand)]/40"
                  >
                    <Plus className="size-6 text-[var(--brand)]" aria-hidden />
                    <p className="text-sm font-medium text-muted-foreground">No saved addresses yet</p>
                    <p className="text-xs text-muted-foreground">Save your estate and building for one-tap reordering.</p>
                  </Link>
                ) : (
                  <>
                    {summary.addresses.map((a) => (
                      <div key={a.id} className="rounded-xl border border-border bg-white p-4 sm:p-5">
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
                <div className="mt-6 rounded-xl bg-brand-soft p-4">
                  <p className="text-[15px] font-extrabold text-foreground">Quick reorder</p>
                  <p className="mt-1.5 text-sm text-foreground/85">
                    Your last order was <strong className="font-semibold">{itemsSummary(lastOrder)}</strong> from{" "}
                    {lastOrder.businessName}.
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)] disabled:opacity-50"
                    disabled={pendingId === lastOrder.id}
                    aria-busy={pendingId === lastOrder.id}
                    onClick={() => reorder(lastOrder.id)}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {pendingId === lastOrder.id ? "Adding to cart…" : "Order again"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
