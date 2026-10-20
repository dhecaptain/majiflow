"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import type { Business, BusinessProduct } from "@/lib/types";
import { businesses } from "@/lib/data/businesses";
import { maxOrderQuantity, resolveCart } from "@/lib/cart";
import { lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/components/order/cart-provider";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { useBusinessAvailability } from "@/components/shared/business-availability";

/** Quantity, line total and the next step for the item being viewed. */
export function ItemPurchasePanel({ business, product }: { business: Business; product: BusinessProduct }) {
  const { items, hydrated, addItem, updateQuantity } = useCart();
  const { toast } = useToast();
  const availability = useBusinessAvailability(business.openingHours);
  const [qty, setQty] = useState(1);

  const max = maxOrderQuantity(product);
  const inCart = items.find((i) => i.businessId === business.id && i.productId === product.id);
  const canOrder = availability.state === "open" && max > 0;
  const pick = Math.min(qty, Math.max(1, max));
  const canCheckout = hydrated && resolveCart(items, businesses).canCheckout;

  const unavailableReason =
    max === 0
      ? `${product.name} is out of stock at ${business.name}.`
      : availability.state === "closed"
        ? "The station is closed, so this item can't be ordered right now."
        : availability.state === "unknown"
          ? "Ordering is paused until the station confirms its opening hours."
          : null;

  if (!hydrated) {
    return <div aria-hidden className="h-[9.5rem] animate-pulse rounded-2xl bg-muted" />;
  }

  if (inCart) {
    return (
      <div className="rounded-2xl border border-[#0052FF]/25 bg-[#0052FF]/5 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> In your cart
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={inCart.quantity}
            min={0}
            max={Math.max(max, 0)}
            label={product.name}
            onChange={(n) => updateQuantity(business.id, product.id, n)}
          />
          <p className="text-sm text-muted-foreground">
            Line total{" "}
            <strong className="text-foreground">{formatKES(lineSubtotal(product.price, inCart.quantity))}</strong>
          </p>
        </div>
        {unavailableReason && <p className="mt-3 text-xs text-danger">{unavailableReason}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {canCheckout ? (
            <Link href="/checkout" className={buttonVariants({ size: "lg", className: "w-full" })}>
              Go to checkout
            </Link>
          ) : (
            <Link href="/cart" className={buttonVariants({ size: "lg", className: "w-full" })}>
              Review cart
            </Link>
          )}
          <Link
            href={`/browse/${business.slug}#menu`}
            className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
          >
            Add more items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5">
      {canOrder ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper value={pick} max={max} label={product.name} onChange={setQty} />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Total <strong className="text-lg text-foreground">{formatKES(lineSubtotal(product.price, pick))}</strong>
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Up to {max} per order{max < 20 ? ` - ${max} left in stock` : ""}.
          </p>
          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={() => {
              addItem({ businessId: business.id, productId: product.id, quantity: pick });
              toast({ kind: "success", title: "Added to cart", message: `${pick} × ${product.name}` });
              setQty(1);
            }}
          >
            <ShoppingCart className="size-4" aria-hidden /> Add to cart · {formatKES(lineSubtotal(product.price, pick))}
          </Button>
        </>
      ) : (
        <>
          <Button size="lg" className="w-full" disabled>
            {max === 0 ? "Out of stock" : "Not available right now"}
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">{unavailableReason}</p>
        </>
      )}
    </div>
  );
}
