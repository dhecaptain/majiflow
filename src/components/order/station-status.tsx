"use client";

import Link from "next/link";
import { AlertCircle, ShoppingCart } from "lucide-react";
import type { Business } from "@/lib/types";
import { businesses } from "@/lib/data/businesses";
import { resolveCart } from "@/lib/cart";
import { lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/components/order/cart-provider";
import { useBusinessAvailability } from "@/components/shared/business-availability";

/** Explains why a station can't take orders right now; renders nothing while it is open. */
export function StationAvailabilityNotice({ business, className }: { business: Business; className?: string }) {
  const availability = useBusinessAvailability(business.openingHours);
  if (availability.state === "open") return null;
  const closed = availability.state === "closed";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm",
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

/** Sticky summary of this station's items in the cart, with the next step one tap away. */
export function StationCartBar({ business }: { business: Business }) {
  const { items, hydrated } = useCart();
  if (!hydrated) return null;
  const cart = resolveCart(items, businesses);
  const here = cart.orderable.filter((l) => l.business?.id === business.id);
  if (here.length === 0) return null;
  const count = here.reduce((n, l) => n + l.line.quantity, 0);
  const subtotal = here.reduce((sum, l) => sum + lineSubtotal(l.unitPrice, l.line.quantity), 0);
  const otherStations = new Set(cart.orderable.map((l) => l.business?.id).filter((id) => id !== business.id)).size;

  return (
    <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-6">
      <div
        role="region"
        aria-label="Your cart from this station"
        className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-border bg-white/95 p-3 shadow-layered backdrop-blur-md"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          <ShoppingCart className="size-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block truncate font-semibold text-foreground">
            {count} {count === 1 ? "item" : "items"} · {formatKES(subtotal)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {otherStations > 0
              ? `+ items from ${otherStations} other ${otherStations === 1 ? "station" : "stations"}`
              : "Delivery fee shown at checkout"}
          </span>
        </p>
        <Link href="/cart" className={buttonVariants({ variant: "secondary", size: "sm", className: "hidden h-10 sm:inline-flex" })}>
          Cart
        </Link>
        {cart.canCheckout ? (
          <Link href="/checkout" className={buttonVariants({ size: "sm", className: "h-10" })}>
            Checkout
          </Link>
        ) : (
          <Link href="/cart" className={buttonVariants({ size: "sm", className: "h-10" })}>
            Review
          </Link>
        )}
      </div>
    </div>
  );
}
