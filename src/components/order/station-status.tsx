"use client";

import Link from "next/link";
import { AlertCircle, ShoppingBag } from "lucide-react";
import type { Business } from "@/lib/types";
import { useStations } from "@/components/order/stations-provider";
import { resolveCart } from "@/lib/cart";
import { lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/order/cart-provider";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useBottomBarLift } from "@/lib/use-bottom-bar";

/** Explains why a station can't take orders right now; renders nothing while it is open. */
export function StationAvailabilityNotice({ business, className }: { business: Business; className?: string }) {
  const availability = useBusinessAvailability(business.openingHours);
  if (availability.state === "open") return null;
  const closed = availability.state === "closed";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm",
        closed ? "border-danger/25 bg-danger-soft text-danger" : "border-warning/25 bg-warning-soft text-warning",
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>
        <strong className="font-semibold">
          {closed ? `${business.name} is closed right now.` : `${business.name} hasn't confirmed its hours.`}
        </strong>{" "}
        {closed
          ? `${availability.hoursLabel}. You can browse, but ordering opens during these hours.`
          : "Ordering is paused until the station publishes its opening hours."}
      </p>
    </div>
  );
}

/**
 * Sticky bar with what is in the cart; one tap to the cart. An order comes
 * from one station, so this is the whole cart, even on another station's page
 * (where a phone has no header cart button).
 */
export function StationCartBar() {
  const businesses = useStations();
  const { items, hydrated } = useCart();
  const cart = resolveCart(items, businesses);
  const here = cart.orderable;
  const visible = hydrated && here.length > 0;
  useBottomBarLift(visible);
  if (!visible) return null;
  const count = here.reduce((n, l) => n + l.line.quantity, 0);
  const subtotal = here.reduce((sum, l) => sum + lineSubtotal(l.unitPrice, l.line.quantity), 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eef3fa] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:border-0 lg:bg-transparent lg:pb-6 lg:backdrop-blur-none">
      <Link
        href="/cart"
        aria-label={`View cart: ${count} ${count === 1 ? "item" : "items"}, ${formatKES(subtotal)}`}
        className="mx-auto flex h-14 max-w-xl items-center gap-3 rounded-lg bg-[var(--brand)] px-4 text-white shadow-accent transition-colors hover:bg-[var(--cta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-white/20 px-1.5 text-sm font-extrabold">
          {count}
        </span>
        <span className="flex flex-1 items-center gap-2 text-base font-bold">
          <ShoppingBag className="size-5" aria-hidden />
          View cart
        </span>
        <span className="text-base font-extrabold">{formatKES(subtotal)}</span>
      </Link>
    </div>
  );
}

const PILL = {
  open: { label: "Open now", className: "bg-success-soft text-success" },
  closed: { label: "Closed now", className: "bg-danger-soft text-danger" },
  unknown: { label: "Hours not confirmed", className: "bg-warning-soft text-warning" },
} as const;

/** "Open now" pill with today's hours, live. */
export function StationOpenPill({ business }: { business: Business }) {
  const availability = useBusinessAvailability(business.openingHours);
  const pill = PILL[availability.state];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", pill.className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {pill.label}
      {availability.state !== "unknown" && <span className="font-semibold opacity-80">· {availability.hoursLabel}</span>}
    </span>
  );
}

/** Delivery or pickup, remembered for the whole order. */
export function FulfilmentToggle({ business }: { business: Business }) {
  const { fulfilment, setFulfilment } = useOrderSession();
  const options = [
    { id: "delivery" as const, label: "Delivery", note: `~${business.avgDeliveryMinutes} min` },
    {
      id: "pickup" as const,
      label: "Pickup",
      note: business.nearbyDiscountPercent ? `Save ${business.nearbyDiscountPercent}%` : "Collect yourself",
    },
  ];
  return (
    <div role="radiogroup" aria-label="How you get your order" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
      {options.map((option) => {
        const on = fulfilment === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setFulfilment(option.id)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]",
              on ? "bg-white text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            <span className="font-medium text-muted-foreground">· {option.note}</span>
          </button>
        );
      })}
    </div>
  );
}
