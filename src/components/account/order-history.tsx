"use client";

import Link from "next/link";
import { useState } from "react";
import { PackageOpen, RotateCcw } from "lucide-react";
import { Container } from "@/components/ui/container";
import { OrderStatusBadge, paymentMeta } from "@/components/ui/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import {
  AccountError,
  AccountPageHeader,
  itemsSummary,
  useAccountResource,
  useReorder,
} from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import type { OrderFilter } from "@/lib/account";
import { formatKES } from "@/lib/format";
import type { Order } from "@/lib/types";

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

function ReorderButton({ order, pending, onReorder }: { order: Order; pending: boolean; onReorder: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="min-h-11 sm:min-h-9"
      disabled={pending}
      aria-busy={pending}
      aria-label={`Reorder ${order.orderNumber}`}
      onClick={onReorder}
    >
      <RotateCcw className="size-3.5" aria-hidden /> {pending ? "Adding…" : "Reorder"}
    </Button>
  );
}

export function OrderHistoryPage() {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const { resource, reload } = useAccountResource(filter, () => accountApi.orders(filter));
  const { reorder, pendingId } = useReorder();

  return (
    <Container className="py-6 lg:py-8">
      <AccountPageHeader title="All your orders" description="Every refill you have ordered, newest first." />

      <div role="group" aria-label="Filter orders" className="mb-5 flex gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            className="min-h-11 px-4 sm:min-h-9"
            variant={filter === f.value ? "default" : "secondary"}
            aria-pressed={filter === f.value}
            onClick={() => {
              if (filter === f.value) return;
              setFilter(f.value);
              reload();
            }}
          >
            {f.label}
          </Button>
        ))}
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
            <Link href="/browse">
              <Button>Start an order</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {resource.data.total} order{resource.data.total === 1 ? "" : "s"}
          </p>

          {/* Mobile: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {resource.data.orders.map((o) => (
              <li key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <Link href={`/account/orders/${o.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.orderNumber} · <OrderDate iso={o.placedAt} />
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-2 font-medium text-foreground">{o.businessName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{itemsSummary(o)}</p>
                </Link>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{formatKES(o.total)}</span>
                    <Badge variant={paymentMeta(o).tone}>
                      {paymentMeta(o).label}
                    </Badge>
                  </div>
                  <ReorderButton order={o} pending={pendingId === o.id} onReorder={() => reorder(o.id)} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Your orders</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Order", "Station", "Items", "Total", "Payment", "Status"].map((h) => (
                      <th key={h} scope="col" className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                        <Link href={`/account/orders/${o.id}`} className="font-semibold text-[var(--brand)] hover:underline">
                          {o.orderNumber}
                        </Link>
                        <span className="mt-0.5 block">
                          <OrderDate iso={o.placedAt} />
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-foreground">{o.businessName}</td>
                      <td className="px-5 py-4 text-foreground/85">{itemsSummary(o)}</td>
                      <td className="px-5 py-4 font-bold text-foreground">{formatKES(o.total)}</td>
                      <td className="px-5 py-4">
                        <Badge variant={paymentMeta(o).tone}>
                          {paymentMeta(o).label}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-4">
                        <ReorderButton order={o} pending={pendingId === o.id} onReorder={() => reorder(o.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Container>
  );
}
