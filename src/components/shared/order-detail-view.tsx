"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, MapPin, Phone, Radio, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PAYMENT_STATE_META } from "@/components/ui/order-status-badge";
import { LoadingState, ErrorState } from "@/components/ui/feedback";
import { OrderMap, type MapPoint } from "@/components/ui/order-map";
import { FulfilmentPanel } from "@/components/shared/fulfilment-panel";
import { fetchOrder, fetchOrderLocation, type OrderLocationSnapshot } from "@/lib/orders";
import { isActiveStatus } from "@/lib/order-status";
import { businesses } from "@/lib/data/businesses";
import { CITY_COORDS, ESTATE_COORDS } from "@/lib/constants";
import { formatKES, formatPhone } from "@/lib/format";
import type { FulfillmentActor, Order, OrderStatus, OrderTimelineEntry } from "@/lib/types";

const TIMELINE_LABEL: Record<OrderStatus, string> = {
  pending: "Order placed",
  accepted: "Station accepted",
  preparing: "Preparing",
  rider_assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ACTOR_LABEL: Record<FulfillmentActor, string> = {
  station: "Station",
  rider: "Rider",
  customer: "Customer",
  admin: "MajiFlow admin",
  system: "System",
};

function addressPoint(order: Order): MapPoint {
  if (typeof order.address.lat === "number" && typeof order.address.lng === "number") {
    return {
      lat: order.address.lat,
      lng: order.address.lng,
      label: order.address.estate || "Delivery location",
    };
  }
  const estate = ESTATE_COORDS[order.address.estate];
  const coords = estate ?? CITY_COORDS.Nairobi;
  return { ...coords, label: order.address.estate || "Delivery address" };
}

function stationPoint(order: Order): MapPoint | undefined {
  const station = businesses.find((b) => b.id === order.businessId);
  return station ? { lat: station.lat, lng: station.lng, label: station.name } : undefined;
}

function timelineOf(order: Order): OrderTimelineEntry[] {
  if (order.timeline?.length) return order.timeline;
  return [{ status: order.status, at: order.placedAt }];
}

/**
 * Shared live-tracking view for a single order - used by the vendor
 * dashboard (`/business/orders/[id]`) and the platform admin
 * (`/admin/orders/[id]`). Reads and actions are authorized server-side.
 */
export function OrderDetailView({
  id,
  backHref,
  backLabel,
  actor,
}: {
  id: string;
  backHref: string;
  backLabel: string;
  actor: "station" | "admin";
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [snapshot, setSnapshot] = useState<OrderLocationSnapshot | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const [o, loc] = await Promise.all([fetchOrder(id), fetchOrderLocation(id)]);
      if (!alive) return;
      setOrder(o);
      setSnapshot(loc);
      setFetchedAt(Date.now());
      setLoading(false);
    };
    void tick();
    const poll = window.setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading order…" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-10">
        <ErrorState
          title="Order not available"
          message="This order does not exist, or it belongs to another station."
          action={
            <Link href={backHref}>
              <Button size="lg">{backLabel}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const active = isActiveStatus(order.status);
  const live = snapshot?.location ?? order.location ?? null;
  const history = snapshot?.history ?? order.locationHistory ?? [];
  const liveAgeMs = live ? fetchedAt - new Date(live.at).getTime() : Number.POSITIVE_INFINITY;
  const liveFresh = liveAgeMs >= 0 && liveAgeMs < 30_000;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--brand)]"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> {backLabel}
          </Link>
          <h1 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
            {order.orderNumber} · {order.customerName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {new Date(order.placedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="size-3.5" aria-hidden /> {order.businessName}
            </span>
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Live map */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 font-display text-lg text-foreground">
              <MapPin className="size-5 text-[var(--brand)]" aria-hidden /> Live tracking
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                liveFresh ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              <Radio className={`size-3 ${liveFresh ? "animate-pulse-dot" : ""}`} aria-hidden />
              {!active
                ? "Tracking ended"
                : liveFresh
                  ? "Customer sharing live"
                  : live
                    ? "Last fix " + Math.max(1, Math.round(liveAgeMs / 60000)) + " min ago"
                    : order.consent?.location
                      ? "Waiting for the customer's location"
                      : "Address pin only"}
            </span>
          </div>

          <OrderMap
            station={stationPoint(order)}
            address={addressPoint(order)}
            location={live}
            history={history}
            className="h-[420px]"
          />

          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h3 className="font-display text-base text-foreground">Delivery address</h3>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {[...new Set([order.address.street, order.address.estate, order.address.city].filter(Boolean))].join(", ") ||
                order.address.estate}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[order.address.building, order.address.floor].filter(Boolean).join(" · ") || "No building info"}
            </p>
            {order.address.notes && (
              <p className="mt-2 text-xs italic text-muted-foreground">“{order.address.notes}”</p>
            )}
            <p className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
              <Phone className="size-4 text-[var(--brand)]" aria-hidden /> {formatPhone(order.customerPhone)}
            </p>
          </div>
        </section>

        {/* Details */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 className="font-display text-lg text-foreground">Order details</h2>
            <ul className="mt-4 space-y-2.5">
              {order.items.map((item) => (
                <li key={`${item.productId}-${item.optionId ?? ""}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.quantity} × {item.name}
                    {item.optionLabel && (
                      <span className="block text-xs font-medium text-[var(--brand)]">{item.optionLabel}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatKES(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-foreground">{formatKES(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {order.fulfilment === "pickup" ? "Collection" : "Delivery"}
                </dt>
                <dd className="text-foreground">{order.deliveryFee === 0 ? "Free" : formatKES(order.deliveryFee)}</dd>
              </div>
              {order.deposit ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Refundable deposit</dt>
                  <dd className="text-foreground">{formatKES(order.deposit)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Total</dt>
                <dd className="font-display text-xl text-foreground">{formatKES(order.total)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 px-3.5 py-2.5">
              <span className="text-xs text-muted-foreground">
                Paid via {order.payment === "mpesa" ? "M-Pesa" : "Card"}
              </span>
              <Badge variant={PAYMENT_STATE_META[order.paymentState].tone}>
                {PAYMENT_STATE_META[order.paymentState].label}
              </Badge>
            </div>
          </section>

          <FulfilmentPanel order={order} actor={actor} onChange={setOrder} />

          {/* Timeline */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 className="font-display text-lg text-foreground">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {timelineOf(order)
                .slice()
                .reverse()
                .map((entry, i) => (
                  <li key={`${entry.status}-${entry.at}-${i}`} className="flex items-start gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{TIMELINE_LABEL[entry.status]}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                        {entry.actor && ` · ${ACTOR_LABEL[entry.actor]}`}
                      </p>
                      {entry.note && <p className="mt-0.5 text-xs text-foreground/80">{entry.note}</p>}
                    </div>
                    <OrderStatusBadge status={entry.status} />
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
