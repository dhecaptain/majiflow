"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bike, CheckCircle2, Clock, Inbox, MapPin, Phone, RefreshCcw, ShieldCheck, Smartphone, Truck, XCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PAYMENT_STATE_META } from "@/components/ui/order-status-badge";
import { LoadingState, ErrorState } from "@/components/ui/feedback";
import { OrderMap, type MapPoint } from "@/components/ui/order-map";
import { businesses } from "@/lib/data/businesses";
import { CITY_COORDS, ESTATE_COORDS } from "@/lib/constants";
import { useCart } from "@/components/order/cart-provider";
import { useFlyToCart } from "@/components/order/fly-to-cart";
import { useToast } from "@/components/ui/toast";
import { ORDER_CONSENT_EVENT } from "@/components/order/geo-share-engine";
import { fetchOrder, setOrderConsent } from "@/lib/orders";
import { isActiveStatus } from "@/lib/order-status";
import { formatKES, formatPhone } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderTotalsList } from "@/components/shared/order-totals";

const STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: "accepted", label: "Order received", desc: "The station confirmed your order." },
  { status: "preparing", label: "Being prepared", desc: "Your water is being filled and sealed." },
  { status: "rider_assigned", label: "Rider assigned", desc: "A rider is collecting your order." },
  { status: "out_for_delivery", label: "Out for delivery", desc: "The rider is on the road and will call before arrival." },
  { status: "delivered", label: "Delivered", desc: "Your refills are at the door." },
];

/** What happens to the customer's money once an order closes without delivery. */
function moneyMessage(order: Order): string {
  if (order.paymentState !== "success" && order.paymentState !== "refunded") {
    return "You were not charged for this order.";
  }
  const amount = formatKES(order.refund?.amount ?? order.total);
  if (order.paymentState === "refunded" || order.refund?.status === "confirmed") {
    return `Your refund of ${amount} has been sent to your M-Pesa.`;
  }
  if (order.refund?.status === "failed") {
    return `We could not start your ${amount} refund automatically - our support team will contact you to return it.`;
  }
  return `Your payment of ${amount} was not released to the station and is being returned to your M-Pesa.`;
}

export function TrackOrderPage({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const fly = useFlyToCart();
  const { toast } = useToast();
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOrder(id).then((o) => {
      if (!alive) return;
      setOrder(o);
      setLoading(false);
    });
    const poll = window.setInterval(async () => {
      const o = await fetchOrder(id);
      if (alive && o) setOrder(o);
    }, 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [id]);

  const changeConsent = async (change: { location?: boolean; smsUpdates?: boolean }) => {
    setConsentBusy(true);
    setConsentError(null);
    const next = await setOrderConsent(id, change);
    setConsentBusy(false);
    if (!next) {
      setConsentError("Your choice could not be saved. Please try again.");
      return;
    }
    setOrder(next);
    window.dispatchEvent(new Event(ORDER_CONSENT_EVENT));
  };

  if (loading) {
    return (
      <Container className="py-20">
        <LoadingState label="Loading your order…" />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container className="py-20">
        <ErrorState
          title="Order not found"
          message="We couldn't find that order on this device. Check the link, or browse for a station to place a new order."
          action={
            <Link href="/browse">
              <Button size="lg">Browse stations</Button>
            </Link>
          }
        />
      </Container>
    );
  }

  const cancelled = order.status === "cancelled" || order.status === "rejected";
  const delivered = order.status === "delivered";
  const active = isActiveStatus(order.status);
  const reachedIndex = STEPS.findIndex((step) => step.status === order.status);
  const payment = PAYMENT_STATE_META[order.paymentState];
  const rider = order.rider && (order.status === "rider_assigned" || order.status === "out_for_delivery") ? order.rider : null;

  const stationPoint = (() => {
    const station = businesses.find((b) => b.id === order.businessId);
    return station ? { lat: station.lat, lng: station.lng, label: station.name } : undefined;
  })();
  const addressPoint: MapPoint = (() => {
    if (typeof order.address.lat === "number" && typeof order.address.lng === "number") {
      return { lat: order.address.lat, lng: order.address.lng, label: order.address.estate || "Delivery location" };
    }
    const coords = ESTATE_COORDS[order.address.estate] ?? CITY_COORDS.Nairobi;
    return { ...coords, label: order.address.estate || "Delivery address" };
  })();
  const live = order.location ?? null;
  const history = order.locationHistory ?? [];

  const reorder = (target: HTMLElement) => {
    fly({
      fromEl: target,
      children: <RefreshCcw className="size-5" aria-hidden />,
      onDone: () => {
        order.items.forEach((item) =>
          addItem({
            businessId: order.businessId,
            productId: item.productId,
            quantity: item.quantity,
            ...(item.optionId ? { optionId: item.optionId } : {}),
          })
        );
        toast({
          kind: "success",
          title: "Same order, added to cart",
          message: `${order.items.length} item${order.items.length > 1 ? "s" : ""} added. Check out when ready.`,
        });
      },
    });
  };

  return (
    <Container className="py-10 lg:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full animate-pulse-dot", cancelled ? "bg-danger" : "bg-foreground")} />
            Order tracking · {order.orderNumber}
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
            {delivered ? "Delivered" : cancelled ? "Order not dispatched" : `${order.businessName} is on it`}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            Placed {new Date(order.placedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
            {order.eta && <span>· ETA {order.eta}</span>}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      {cancelled && (
        <div className="mb-10 flex items-start gap-4 rounded-2xl border border-danger/25 bg-danger/10 p-6">
          <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
          <div>
            <h2 className="font-display text-lg text-danger">
              {order.status === "rejected" ? "The station couldn't accept this order" : "This order was cancelled"}
            </h2>
            {order.closedReason && (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-foreground">
                <span className="font-semibold">Reason:</span> {order.closedReason}
              </p>
            )}
            <p role="status" className="mt-1 max-w-xl text-sm leading-relaxed text-foreground/80">
              {moneyMessage(order)} Try another station nearby - there are usually several with water ready now.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/browse">
                <Button className="group">
                  Find another station
                </Button>
              </Link>
              <Button variant="secondary" onClick={(e) => reorder(e.currentTarget)}>
                <RefreshCcw className="size-4" aria-hidden /> Retry this order elsewhere
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Live map */}
        {!cancelled && (
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 font-display text-lg text-foreground">
                <MapPin className="size-5 text-[var(--brand)]" aria-hidden /> Live tracking
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {live ? "Updating live" : order.consent?.location ? "Waiting for your location" : "Station & address"}
              </span>
            </div>
            <OrderMap
              station={stationPoint}
              address={addressPoint}
              location={live}
              history={history}
              className="mt-5 h-[320px] sm:h-[380px]"
            />
          </section>
        )}

        {/* Timeline */}
        <section className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-lg text-foreground">
            <Truck className="size-5 text-[var(--brand)]" aria-hidden /> Delivery progress
          </h2>
          {cancelled ? (
            <p className="mt-6 text-sm text-muted-foreground">This order closed before delivery.</p>
          ) : (
            <ol className="mt-8" aria-label="Delivery progress">
              {STEPS.map((step, i) => {
                const reached = reachedIndex >= 0 && i <= reachedIndex;
                const current = i === reachedIndex && !delivered;
                return (
                  <li
                    key={step.status}
                    className="relative flex gap-5 pb-8 last:pb-0"
                    aria-current={current ? "step" : undefined}
                  >
                    {i < STEPS.length - 1 && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-[23px] top-12 h-[calc(100%-2.4rem)] w-px",
                          reachedIndex > i ? "bg-[var(--brand)]" : "bg-border"
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full text-white",
                        reached ? "bg-[var(--brand)] shadow-accent" : "border-2 border-border bg-white text-muted-foreground"
                      )}
                    >
                      {current ? (
                        <span className="relative flex size-3">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-50" />
                          <span className="relative inline-flex size-3 rounded-full bg-white" />
                        </span>
                      ) : reached ? (
                        <CheckCircle2 className="size-5" aria-hidden />
                      ) : (
                        <Clock className="size-5" aria-hidden />
                      )}
                    </span>
                    <div className="pt-1.5">
                      <p className={cn("font-semibold", reached ? "text-foreground" : "text-muted-foreground")}>
                        {step.label}
                        <span className="sr-only">{current ? " (current step)" : reached ? " (done)" : " (upcoming)"}</span>
                      </p>
                      <p className={cn("mt-1 text-sm leading-relaxed", reached ? "text-muted-foreground" : "text-muted-foreground/60")}>
                        {step.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {rider && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Bike className="size-5 text-[var(--brand)]" aria-hidden />
                <span>
                  Your rider is <span className="font-semibold">{rider.name}</span>
                </span>
              </p>
              <a
                href={`tel:${rider.phone}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-muted"
                aria-label={`Call ${rider.name} on ${formatPhone(rider.phone)}`}
              >
                <Phone className="size-4" aria-hidden /> {formatPhone(rider.phone)}
              </a>
            </div>
          )}

          {order.status === "pending" && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4">
              <Inbox className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <p className="text-sm leading-relaxed text-foreground/85">
                {order.paymentState === "success" ? (
                  <>
                    <strong className="font-semibold text-foreground">Waiting for the station.</strong>{" "}
                    Your payment of {formatKES(order.total)} is held safely and released to{" "}
                    {order.businessName} only when your order is accepted.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-foreground">Waiting for payment.</strong>{" "}
                    Approve the M-Pesa prompt on your phone. The station starts once payment is confirmed.
                  </>
                )}
              </p>
            </div>
          )}
        </section>

        {/* Order details */}
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
            <OrderTotalsList
              totals={{
                subtotal: order.subtotal,
                deliveryFee: order.deliveryFee,
                deposit: order.deposit ?? 0,
                total: order.total,
              }}
              pickup={order.fulfilment === "pickup"}
              className="mt-4 space-y-1.5 border-t border-border pt-4"
              totalClassName="font-display text-xl"
            />
            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="size-4 text-[var(--brand)]" aria-hidden /> {order.payment === "mpesa" ? "M-Pesa" : "Card"}
              </span>
              <Badge variant={payment.tone}>{payment.label}</Badge>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <MapPin className="size-5 text-[var(--brand)]" aria-hidden /> Delivery address
            </h2>
            <p className="mt-3 text-sm font-semibold text-foreground">
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
          </section>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={(e) => reorder(e.currentTarget)} className="group">
              <RefreshCcw className="size-4" aria-hidden /> Reorder this
            </Button>
            <Link href="/account/orders" className="flex-1">
              <Button className="group w-full">
                View all orders
              </Button>
            </Link>
          </div>

          <section aria-labelledby="privacy-heading" className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 id="privacy-heading" className="flex items-center gap-2 font-display text-lg text-foreground">
              <ShieldCheck className="size-5 text-[var(--brand)]" aria-hidden /> Privacy & updates
            </h2>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
                  checked={Boolean(order.consent?.location) && active}
                  disabled={consentBusy || !active}
                  onChange={(e) => void changeConsent({ location: e.target.checked })}
                />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Share my live location</span> with {order.businessName}{" "}
                  while this order is on its way.
                  <span className="block text-xs">
                    {active
                      ? "Turning this off deletes the locations already shared."
                      : "Sharing ended and shared locations were deleted when the order closed."}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
                  checked={order.consent?.smsUpdates !== false}
                  disabled={consentBusy}
                  onChange={(e) => void changeConsent({ smsUpdates: e.target.checked })}
                />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Text me updates</span> about this order.
                </span>
              </label>
            </div>
            {consentError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {consentError}
              </p>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}