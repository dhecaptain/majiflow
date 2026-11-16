"use client";

import Link from "next/link";
import { Bell, ChevronRight, Clock, MapPin, Package, PackageCheck, Plus, Recycle, RotateCcw, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useCustomer } from "@/components/order/customer-provider";
import { ACCOUNT_PAGE, AccountError, CustomerStatusPill, itemsSummary, OrderProgress, useAccountResource, useReorder } from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import { formatKES, formatRelativeTime } from "@/lib/format";
import type { Order } from "@/lib/types";
import { ACTIVE_STATUSES } from "@/lib/account";
import { cn } from "@/lib/utils";

/** One order inside a panel list: station, number, time, total and status. */
function OrderRow({ order, highlight }: { order: Order; highlight?: boolean }) {
  const active = ACTIVE_STATUSES.includes(order.status);
  return (
    <Link
      href={`/account/orders/${order.id}`}
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)] sm:px-5",
        highlight && "bg-brand-soft/40"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-[var(--brand)] text-white" : "bg-surface-2 text-[var(--brand)]"
          )}
        >
          <Package className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{order.businessName}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {itemsSummary(order)} · <time dateTime={order.placedAt}>{formatRelativeTime(order.placedAt)}</time>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-extrabold text-foreground">{formatKES(order.total)}</span>
          <CustomerStatusPill status={order.status} />
        </div>
      </div>
      {active && <OrderProgress status={order.status} />}
    </Link>
  );
}

/** A white panel with a title row; the account overview is built from these. */
function Panel({
  id,
  title,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("overflow-hidden rounded-xl border border-border bg-white", className)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#eef3fa] px-4 sm:px-5">
        <h2 id={id} className="text-[15px] font-extrabold text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[var(--brand)] hover:text-brand-deep">
      {children}
      <ChevronRight className="size-4" aria-hidden />
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
  // Orders already shown under "On the way" are not repeated in the recent list.
  const recentOrders = summary ? summary.recentOrders.filter((o) => !ACTIVE_STATUSES.includes(o.status)) : [];

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">My account</p>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight text-foreground sm:text-[34px]">
            Habari, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your refills, orders and saved places in one spot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summary && summary.unreadNotifications > 0 && (
            <Link
              href="/account/notifications"
              aria-label={`${summary.unreadNotifications} unread notifications`}
              className="relative inline-flex size-12 items-center justify-center rounded-lg border border-border bg-white text-foreground transition-colors hover:bg-brand-soft"
            >
              <Bell className="size-5" aria-hidden />
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-coral-cta px-1.5 py-0.5 text-[11px] font-bold text-white">
                {summary.unreadNotifications}
              </span>
            </Link>
          )}
          <Link
            href="/browse"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)] lg:hidden"
          >
            Order water
          </Link>
        </div>
      </header>

      {resource.status === "error" ? (
        <div className="mt-6">
          <AccountError message={resource.error} code={resource.code} onRetry={reload} />
        </div>
      ) : (
        <>
          <section
            aria-label="Account summary"
            aria-busy={!summary}
            className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-white lg:grid-cols-4"
          >
            {summary
              ? stats.map((s, i) => (
                  <div
                    key={s.label}
                    className={cn(
                      "flex items-center gap-3 p-4 sm:p-5",
                      i % 2 === 1 && "border-l border-[#eef3fa]",
                      i >= 2 && "border-t border-[#eef3fa] lg:border-t-0",
                      i === 2 && "lg:border-l"
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[var(--brand)]">
                      <s.icon className="size-[18px]" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-extrabold leading-tight text-foreground">{s.value}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 sm:p-5">
                    <span className="size-10 shrink-0 animate-pulse rounded-lg bg-surface-2" />
                    <div className="flex-1 space-y-1.5">
                      <span className="block h-5 w-14 animate-pulse rounded bg-surface-2" />
                      <span className="block h-3 w-20 animate-pulse rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
          </section>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              {summary && summary.activeOrders.length > 0 && (
                <Panel id="active-orders" title="On the way">
                  <ul className="divide-y divide-[#eef3fa]">
                    {summary.activeOrders.map((o) => (
                      <li key={o.id}>
                        <OrderRow order={o} highlight />
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <Panel
                id="recent-orders"
                title="Recent orders"
                action={summary && summary.recentOrders.length > 0 ? <PanelLink href="/account/orders">View all</PanelLink> : undefined}
              >
                {!summary ? (
                  <div className="space-y-3 p-4" role="status" aria-label="Loading orders">
                    {[1, 2].map((i) => (
                      <SkeletonCard key={i} variant="row" />
                    ))}
                  </div>
                ) : recentOrders.length === 0 && summary.activeOrders.length > 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">Finished orders show up here.</p>
                ) : recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-[var(--brand)]">
                      <PackageCheck className="size-6" aria-hidden />
                    </span>
                    <p className="mt-3 text-[15px] font-bold text-foreground">No orders yet</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Your first order shows up here with live tracking.
                    </p>
                    <Link href="/browse" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                      Find your station
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#eef3fa]">
                    {recentOrders.map((o) => (
                      <li key={o.id}>
                        <OrderRow order={o} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="space-y-6">
              {lastOrder && (
                <section aria-labelledby="quick-reorder" className="rounded-xl bg-[var(--brand)] p-5 text-white">
                  <p id="quick-reorder" className="text-[15px] font-extrabold">
                    Order the usual
                  </p>
                  <p className="mt-1.5 text-sm text-white/85">
                    <strong className="font-semibold text-white">{itemsSummary(lastOrder)}</strong> from {lastOrder.businessName}.
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-bold text-[var(--brand)] transition-colors hover:bg-brand-soft disabled:opacity-60"
                    disabled={pendingId === lastOrder.id}
                    aria-busy={pendingId === lastOrder.id}
                    onClick={() => reorder(lastOrder.id)}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {pendingId === lastOrder.id ? "Adding to cart…" : "Order again"}
                  </button>
                </section>
              )}

              <Panel id="saved-addresses" title="Saved addresses" action={<PanelLink href="/account/addresses">Manage</PanelLink>}>
                {!summary ? (
                  <div className="p-4">
                    <SkeletonCard variant="row" />
                  </div>
                ) : summary.addresses.length === 0 ? (
                  <Link
                    href="/account/addresses"
                    className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--brand)]/40 text-[var(--brand)]">
                      <Plus className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">Add an address</span>
                      <span className="block text-xs text-muted-foreground">Save your estate and building for faster checkout.</span>
                    </span>
                  </Link>
                ) : (
                  <ul className="divide-y divide-[#eef3fa]">
                    {summary.addresses.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[var(--brand)]">
                          <MapPin className="size-[18px]" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <span className="truncate">{a.label}</span>
                            {a.isDefault && <Badge variant="success">Default</Badge>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[a.estate, a.building, a.floor].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </li>
                    ))}
                    {summary.addressCount > summary.addresses.length && (
                      <li className="px-5 py-3 text-xs text-muted-foreground">
                        +{summary.addressCount - summary.addresses.length} more saved
                      </li>
                    )}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

