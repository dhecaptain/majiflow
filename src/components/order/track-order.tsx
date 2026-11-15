"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Bike, ChevronLeft, CircleHelp, Clock, Inbox, MapPin, Phone, RefreshCcw, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { paymentMeta, paymentMethodLabel } from "@/components/ui/order-status-badge";
import { LoadingState, ErrorState } from "@/components/ui/feedback";
import { OrderMap, type MapPoint } from "@/components/ui/order-map";
import { useStations } from "@/components/order/stations-provider";
import { useCustomer } from "@/components/order/customer-provider";
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
import { OrderProgress } from "@/components/account/account-ui";

/** Status card copy per order status (eyebrow, fallback heading, one-line explanation). */
const STATUS_COPY: Record<OrderStatus, { eyebrow: string; heading: string; desc: string }> = {
  pending: { eyebrow: "Order placed", heading: "Waiting for the station", desc: "The station will confirm your order shortly." },
  accepted: { eyebrow: "Order received", heading: "Order accepted", desc: "The station confirmed your order." },
  preparing: { eyebrow: "Being prepared", heading: "Your water is being prepared", desc: "Your water is being filled and sealed." },
  rider_assigned: { eyebrow: "Rider assigned", heading: "A rider is collecting your order", desc: "A rider is collecting your order." },
  out_for_delivery: {
    eyebrow: "On the way",
    heading: "On the way to you",
    desc: "The rider is on the road and will call before arrival.",
  },
  delivered: { eyebrow: "Delivered", heading: "Delivered", desc: "Your refills are at the door." },
  rejected: { eyebrow: "Rejected", heading: "Order not dispatched", desc: "" },
  cancelled: { eyebrow: "Cancelled", heading: "Order not dispatched", desc: "" },
};

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
  const businesses = useStations();
  const { loggedIn } = useCustomer();
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
          message="We couldn't find that order. Check the link from your SMS, or sign in to see every order on your account."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/account/orders" className={buttonVariants({ size: "lg" })}>My orders</Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Sign in
              </Link>
              <Link href="/browse" className={buttonVariants({ size: "lg", variant: "ghost" })}>Browse stations</Link>
            </div>
          }
        />
      </Container>
    );
  }

  const cancelled = order.status === "cancelled" || order.status === "rejected";
  const delivered = order.status === "delivered";
  const active = isActiveStatus(order.status);
  const payment = paymentMeta(order);
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

  const meta = STATUS_COPY[order.status];
  const etaText = order.eta?.replace(/^[≈~]\s*/, "").trim();
  const heading = cancelled
    ? order.status === "rejected"
      ? "The station couldn't accept this order"
      : "This order was cancelled"
    : order.status === "out_for_delivery" && etaText
      ? `Arriving in about ${etaText}`
      : order.status === "pending" && order.payment !== "cod" && order.paymentState !== "success"
        ? "Waiting for payment"
        : meta.heading;
  const placed = new Date(order.placedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  const backHref = loggedIn ? "/account/orders" : "/browse";
  const riderInitials = rider
    ? rider.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "";
  const addressLine = [
    [...new Set([order.address.street, order.address.estate, order.address.city].filter(Boolean))].join(", ") ||
      order.address.estate,
    [order.address.building, order.address.floor].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const payOnDelivery = order.payment === "cod" && !cancelled && order.paymentState !== "success";

  const backButton = (
    <Link
      href={backHref}
      aria-label={loggedIn ? "Back to orders" : "Back to stations"}
      className="flex size-11 items-center justify-center rounded-full bg-white text-foreground shadow-card transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <ChevronLeft className="size-5" aria-hidden />
    </Link>
  );
  const orderPill = (
    <span className="inline-flex h-[30px] items-center rounded-full bg-white px-3 text-xs font-bold text-foreground shadow-card">
      Order {order.orderNumber}
    </span>
  );

  return (
    <div className="min-h-svh bg-surface-2 pb-10 lg:pb-16">
      <div className="mx-auto max-w-[1200px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:px-6 lg:pt-8">
        {/* Map + status */}
        <div className="flex min-w-0 flex-col">
          {cancelled ? (
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:px-0 lg:pt-0">
              {backButton}
              {orderPill}
            </div>
          ) : (
            <div className="relative isolate h-[300px] lg:h-[420px]">
              <OrderMap
                station={stationPoint}
                address={addressPoint}
                location={live}
                history={history}
                className="size-full rounded-none! border-0! lg:rounded-2xl! lg:border!"
              />
              <div className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top)+0.875rem)] z-[1000] flex items-center justify-between">
                <span className="pointer-events-auto">{backButton}</span>
                {orderPill}
              </div>
              <span className="pointer-events-none absolute bottom-9 left-4 z-[1000] inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-bold text-foreground shadow-card lg:bottom-4">
                <MapPin className="size-3.5 text-[var(--brand)]" aria-hidden />
                {live ? "Updating live" : order.consent?.location ? "Waiting for your location" : "Station & address"}
              </span>
            </div>
          )}

          <div className={cn("relative z-10 flex flex-col gap-3.5 px-4 lg:px-0", cancelled ? "mt-4" : "-mt-6 lg:mt-5")}>
            <section
              aria-labelledby="order-status-heading"
              className="flex flex-col gap-4 rounded-2xl bg-white px-[18px] py-5 shadow-card"
            >
              <div className="flex flex-col gap-1">
                <p
                  className={cn(
                    "flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em]",
                    cancelled ? "text-danger" : delivered ? "text-success" : "text-aqua-deep"
                  )}
                >
                  {active && <span aria-hidden className="size-1.5 rounded-full bg-current animate-pulse-dot" />}
                  {meta.eyebrow}
                </p>
                <h1 id="order-status-heading" className="font-display text-[26px] font-bold leading-[1.15] text-foreground lg:text-[32px]">
                  {heading}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {cancelled ? `${order.businessName} · placed ${placed}` : meta.desc}
                </p>
                {!cancelled && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden />
                    Placed {placed}
                    {order.eta && !delivered && order.status !== "out_for_delivery" && <span>· ETA {order.eta}</span>}
                  </p>
                )}
              </div>

              {!cancelled && <OrderProgress status={order.status} labels />}

              {cancelled && (
                <div className="flex flex-col gap-3">
                  {order.closedReason && (
                    <p className="text-sm leading-relaxed text-foreground">
                      <span className="font-semibold">Reason:</span> {order.closedReason}
                    </p>
                  )}
                  <p role="status" className="flex items-start gap-2.5 rounded-md bg-danger-soft p-3 text-sm leading-relaxed text-foreground">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    <span>
                      {moneyMessage(order)} Try another station nearby - there are usually several with water ready now.
                    </span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/browse"
                      className="flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
                    >
                      Find another station
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => reorder(e.currentTarget)}
                      className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 text-[15px] font-bold text-brand-deep transition-colors hover:bg-brand-soft/70"
                    >
                      <RefreshCcw className="size-4" aria-hidden /> Retry this order elsewhere
                    </button>
                  </div>
                </div>
              )}

              {order.status === "pending" && (
                <div className="flex items-start gap-3 rounded-md bg-warning-soft p-3.5">
                  <Inbox className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                  <p className="text-sm leading-relaxed text-foreground/85">
                    {order.payment === "cod" ? (
                      <>
                        <strong className="font-semibold text-foreground">Waiting for the station.</strong>{" "}
                        {order.businessName} will confirm your order shortly. You pay {formatKES(order.total)} when it
                        arrives, in cash or by M-Pesa to the rider.
                      </>
                    ) : order.paymentState === "success" ? (
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

            {rider && (
              <section aria-label="Your rider" className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5">
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy font-extrabold text-white"
                >
                  {riderInitials || <Bike className="size-5" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold text-foreground">{rider.name}</span>
                  <span className="text-[13px] text-muted-foreground">Your rider · {formatPhone(rider.phone)}</span>
                </span>
                <a
                  href={`tel:${rider.phone}`}
                  aria-label={`Call ${rider.name} on ${formatPhone(rider.phone)}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success transition-colors hover:bg-success/20"
                >
                  <Phone className="size-5" aria-hidden />
                </a>
              </section>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-3.5 flex flex-col gap-3.5 px-4 lg:mt-0 lg:px-0">
          <section aria-labelledby="order-details-heading" className="flex flex-col gap-2.5 rounded-xl border border-border bg-white p-4">
            <h2 id="order-details-heading" className="mb-0.5 text-[15px] font-extrabold text-foreground">
              Order details
            </h2>
            <p className="text-[13px] font-semibold text-muted-foreground">{order.businessName}</p>
            <div className="flex items-start gap-2.5 text-sm text-foreground">
              <MapPin className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                {addressLine || "No address details"}
                {order.address.notes && (
                  <span className="mt-0.5 block text-xs italic text-muted-foreground">“{order.address.notes}”</span>
                )}
              </span>
            </div>
            <p className="flex items-center gap-2.5 text-sm text-foreground">
              <Phone className="size-[18px] shrink-0 text-muted-foreground" aria-hidden /> {formatPhone(order.customerPhone)}
            </p>
            <div aria-hidden className="h-px bg-[#eef3fa]" />
            <ul className="flex flex-col gap-2.5">
              {order.items.map((item) => (
                <li key={`${item.productId}-${item.optionId ?? ""}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-foreground">
                    {item.quantity} × {item.name}
                    {item.optionLabel && (
                      <span className="block text-xs font-medium text-[var(--brand)]">{item.optionLabel}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">{formatKES(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-2.5 text-sm">
              {(order.deposit ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Refundable deposit</dt>
                  <dd className="font-semibold text-foreground">{formatKES(order.deposit ?? 0)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{order.fulfilment === "pickup" ? "Collection" : "Delivery"}</dt>
                <dd className="font-semibold text-foreground">
                  {order.deliveryFee === 0 ? <span className="text-success">Free</span> : formatKES(order.deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-extrabold text-foreground">
                <dt>{payOnDelivery ? "To pay on delivery" : "Total"}</dt>
                <dd>{formatKES(order.total)}</dd>
              </div>
            </dl>
            <div className="mt-1 flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3.5 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {order.payment === "cod" ? (
                  <Banknote className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                ) : (
                  <Smartphone className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                )}
                {paymentMethodLabel(order.payment)}
              </span>
              <Badge variant={payment.tone}>{payment.label}</Badge>
            </div>
          </section>

          {!cancelled && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={(e) => reorder(e.currentTarget)}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-soft px-3 text-sm font-bold text-brand-deep transition-colors hover:bg-brand-soft/70"
              >
                <RefreshCcw className="size-4" aria-hidden /> Reorder this
              </button>
              {/* Guests have no order history to open; send them back to shopping instead. */}
              <Link
                href={loggedIn ? "/account/orders" : "/browse"}
                className="flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-sm font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
              >
                {loggedIn ? "View all orders" : "Order more water"}
              </Link>
            </div>
          )}

          <section aria-labelledby="privacy-heading" className="rounded-xl border border-border bg-white p-4">
            <h2 id="privacy-heading" className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
              <ShieldCheck className="size-[18px] text-[var(--brand)]" aria-hidden /> Privacy & updates
            </h2>
            <div className="mt-3 space-y-3">
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

          <Link
            href="/contact"
            className="flex h-[52px] items-center justify-center gap-2 rounded-lg border border-border bg-white text-[15px] font-bold text-foreground transition-colors hover:bg-surface-2"
          >
            <CircleHelp className="size-5" aria-hidden /> Get help with this order
          </Link>
        </div>
      </div>
    </div>
  );
}
