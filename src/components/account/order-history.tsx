"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Droplet, PackageOpen, RotateCcw } from "lucide-react";
import { ORDER_STATUS_META, paymentMeta } from "@/components/ui/order-status-badge";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { BlurImage } from "@/components/ui/blur-image";
import { useStations } from "@/components/order/stations-provider";
import {
  ACCOUNT_PAGE,
  AccountError,
  CustomerStatusPill,
  OrderProgress,
  AccountPageHeader,
  itemsSummary,
  useAccountResource,
  useReorder,
} from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import { ACTIVE_STATUSES, type OrderFilter } from "@/lib/account";
import { formatKES } from "@/lib/format";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "past", label: "Past" },
];

const EMPTY_COPY: Record<OrderFilter, { title: string; description: string }> = {
  all: {
    title: "Nothing here yet",
    description: "Place your first order and it will live in this history - handy for reordering next week.",
  },
  active: { title: "No orders in progress", description: "Orders waiting for the station or on the way show up here." },
  past: { title: "No past orders", description: "Delivered, cancelled and rejected orders show up here." },
};

function OrderDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso}>
      {new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
    </time>
  );
}

/** Station cover from the catalogue, or a plain water tile when the station is no longer listed. */
function StationThumb({ businessId }: { businessId: string }) {
  const businesses = useStations();
  const station = businesses.find((b) => b.id === businessId);
  return (
    <span aria-hidden className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-soft text-[var(--brand)]">
      {station ? (
        <BlurImage src={station.cover} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <Droplet className="size-5" />
      )}
    </span>
  );
}

function OrderCardHead({ order }: { order: Order }) {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div className="flex items-center gap-3">
      <StationThumb businessId={order.businessId} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] font-bold text-foreground">{order.businessName}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {order.orderNumber} · <OrderDate iso={order.placedAt} /> · {count} item{count === 1 ? "" : "s"} ·{" "}
          {formatKES(order.total)}
        </p>
      </div>
      <CustomerStatusPill status={order.status} />
    </div>
  );
}

function ActiveOrderCard({ order }: { order: Order }) {
  return (
    <article className="flex flex-col gap-3.5 rounded-xl border border-[var(--brand)]/40 bg-white p-4 shadow-[0_0_0_3px_rgba(0,87,230,0.06)] sm:p-5">
      <OrderCardHead order={order} />
      <OrderProgress status={order.status} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef3fa] pt-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {order.eta ? `ETA ${order.eta}` : ORDER_STATUS_META[order.status].label}
          <span className="font-medium text-muted-foreground"> · {paymentMeta(order).label}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/account/orders/${order.id}`}
            aria-label={`Details for ${order.orderNumber}`}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-2"
          >
            Details
          </Link>
          <Link
            href={`/order/${order.id}`}
            aria-label={`Track ${order.orderNumber}`}
            className="inline-flex h-10 items-center gap-1 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
          >
            Track order <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** A finished order as a row in the past-orders panel. */
function PastOrderRow({ order, pending, onReorder }: { order: Order; pending: boolean; onReorder: () => void }) {
  return (
    <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StationThumb businessId={order.businessId} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-foreground">{order.businessName}</span>
            <CustomerStatusPill status={order.status} className="sm:hidden" />
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{itemsSummary(order)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {order.orderNumber} · <OrderDate iso={order.placedAt} /> · {paymentMeta(order).label}
          </p>
        </div>
      </div>
      <div className="hidden w-28 shrink-0 flex-col items-end gap-1 sm:flex">
        <span className="text-sm font-extrabold text-foreground">{formatKES(order.total)}</span>
        <CustomerStatusPill status={order.status} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-auto text-sm font-extrabold text-foreground sm:hidden">{formatKES(order.total)}</span>
        <Link
          href={`/account/orders/${order.id}`}
          aria-label={`Details for ${order.orderNumber}`}
          className="inline-flex h-10 items-center rounded-md px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          Details
        </Link>
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          aria-label={`Reorder ${order.orderNumber}`}
          onClick={onReorder}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-brand-soft px-4 text-sm font-bold text-brand-deep transition-colors hover:bg-brand-soft/70 disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden /> {pending ? "Adding…" : "Order again"}
        </button>
      </div>
    </article>
  );
}

export function OrderHistoryPage() {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const { resource, reload } = useAccountResource(filter, () => accountApi.orders(filter));
  const { reorder, pendingId } = useReorder();

  const renderList = (orders: Order[]) => {
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    const past = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));
    return (
      <div className="flex flex-col gap-3">
        {active.length > 0 && (
          <ul className="flex flex-col gap-3">
            {active.map((o) => (
              <li key={o.id}>
                <ActiveOrderCard order={o} />
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <ul className="divide-y divide-[#eef3fa] overflow-hidden rounded-xl border border-border bg-white">
            {past.map((o) => (
              <li key={o.id}>
                <PastOrderRow order={o} pending={pendingId === o.id} onReorder={() => reorder(o.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className={ACCOUNT_PAGE}>
      <AccountPageHeader title="Orders" description="Every refill you have ordered, newest first." />

      <div
        role="group"
        aria-label="Filter orders"
        className="mb-4 grid grid-cols-3 gap-1 rounded-[14px] border border-border bg-white p-1 sm:max-w-sm"
      >
        {FILTERS.map((f) => {
          const on = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (on) return;
                setFilter(f.value);
                reload();
              }}
              className={cn(
                "h-10 rounded-[10px] text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]",
                on ? "bg-surface-2 text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {resource.status === "loading" ? (
        <LoadingState label="Loading orders…" />
      ) : resource.status === "error" ? (
        <AccountError message={resource.error} code={resource.code} onRetry={reload} />
      ) : resource.data.orders.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-7" aria-hidden />}
          title={EMPTY_COPY[filter].title}
          description={EMPTY_COPY[filter].description}
          action={
            <Link href="/browse" className={buttonVariants()}>Start an order</Link>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {resource.data.total} order{resource.data.total === 1 ? "" : "s"}
          </p>
          {filter === "all" ? (
            (() => {
              const inProgress = resource.data.orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
              const past = resource.data.orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));
              return (
                <div className="flex flex-col gap-6">
                  {inProgress.length > 0 && (
                    <section aria-labelledby="orders-active">
                      <h2 id="orders-active" className="mb-3 text-[15px] font-extrabold text-foreground">
                        In progress
                      </h2>
                      {renderList(inProgress)}
                    </section>
                  )}
                  {past.length > 0 && (
                    <section aria-labelledby="orders-past">
                      <h2 id="orders-past" className="mb-3 text-[15px] font-extrabold text-foreground">
                        Past orders
                      </h2>
                      {renderList(past)}
                    </section>
                  )}
                </div>
              );
            })()
          ) : (
            renderList(resource.data.orders)
          )}
        </>
      )}
    </div>
  );
}
