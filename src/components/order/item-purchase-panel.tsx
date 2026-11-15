"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Business, BusinessProduct, ProductOption } from "@/lib/types";
import { useStations } from "@/components/order/stations-provider";
import { maxOrderQuantity, resolveCart, unitPriceFor } from "@/lib/cart";
import { lineDeposit, lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/components/order/cart-provider";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { ProductOptionCard, productOptionsLegend } from "@/components/order/product-sheet";

/** Quantity, line total and the next step for the item being viewed. */
export function ItemPurchasePanel({ business, product }: { business: Business; product: BusinessProduct }) {
  const businesses = useStations();
  const { items, hydrated, addItem, updateQuantity } = useCart();
  const cartUi = useOptionalCartUi();
  const { toast } = useToast();
  const availability = useBusinessAvailability(business.openingHours);
  const [qty, setQty] = useState(1);
  const [optionId, setOptionId] = useState<string | null>(null);

  const options = product.options ?? [];
  const selectedOption: ProductOption | undefined =
    options.find((o) => o.id === optionId) ??
    options.find((o) => (o.stock ?? product.stock) > 0) ??
    options[0];

  const max = maxOrderQuantity(product, selectedOption);
  const unitPrice = unitPriceFor(product, selectedOption);
  const deposit = selectedOption?.deposit ?? 0;
  const inCart = items.find(
    (i) =>
      i.businessId === business.id &&
      i.productId === product.id &&
      (i.optionId ?? undefined) === (selectedOption?.id ?? undefined)
  );
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
    return <div aria-hidden><SkeletonCard variant="product" className="h-[9.5rem] w-full" /></div>;
  }

  if (inCart) {
    return (
      <div className="rounded-xl border-2 border-[var(--brand)] bg-surface-2 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> In your cart
        </p>
        {selectedOption && (
          <p className="mt-1 text-[13px] font-semibold text-[var(--brand)]">{selectedOption.label}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={inCart.quantity}
            min={0}
            max={Math.max(max, 0)}
            label={product.name}
            onChange={(n) => updateQuantity(inCart, n)}
          />
          <p className="text-sm text-muted-foreground">
            Line total{" "}
            <strong className="text-foreground">
              {formatKES(lineSubtotal(unitPrice, inCart.quantity))}
            </strong>
          </p>
        </div>
        {unavailableReason && <p className="mt-3 text-xs text-danger">{unavailableReason}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {canCheckout ? (
            <Link href="/checkout" className={buttonVariants({ size: "lg", className: "h-14 w-full rounded-lg text-base font-bold" })}>
              Go to checkout
            </Link>
          ) : (
            <Link href="/cart" className={buttonVariants({ size: "lg", className: "h-14 w-full rounded-lg text-base font-bold" })}>
              Review cart
            </Link>
          )}
          <Link
            href={`/browse/${business.slug}#menu`}
            className={buttonVariants({ variant: "secondary", size: "lg", className: "h-14 w-full rounded-lg text-base font-bold shadow-none" })}
          >
            Add more items
          </Link>
        </div>
      </div>
    );
  }

  const total = lineSubtotal(unitPrice, pick) + lineDeposit(deposit, pick);

  return (
    <div className="flex flex-col gap-4">
      {canOrder ? (
        <>
          {options.length > 0 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
                {productOptionsLegend(product)}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  Required
                </span>
              </legend>
              {options.map((option) => (
                <ProductOptionCard
                  key={option.id}
                  name="purchase-option"
                  product={product}
                  option={option}
                  selected={selectedOption?.id === option.id}
                  onSelect={() => {
                    setOptionId(option.id);
                    setQty(1);
                  }}
                />
              ))}
            </fieldset>
          )}
          <p className="text-[13px] text-muted-foreground">
            Up to {max} per order{max < 20 ? ` - ${max} left in stock` : ""}.
            {deposit > 0 ? ` Includes a ${formatKES(deposit)} refundable deposit per unit.` : ""}
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-card">
            <QuantityStepper value={pick} max={max} label={product.name} onChange={setQty} className="shrink-0" />
            <Button
              size="lg"
              className="h-14 min-w-0 flex-1 rounded-lg px-[18px] text-base font-bold hover:translate-y-0 [&>span]:w-full [&>span]:justify-between"
              onClick={() => {
                const line = {
                  businessId: business.id,
                  productId: product.id,
                  quantity: pick,
                  ...(selectedOption ? { optionId: selectedOption.id } : {}),
                };
                if (cartUi) cartUi.requestAdd(line);
                else addItem(line);
                toast({ kind: "success", title: "Added to cart", message: `${pick} × ${product.name}` });
                setQty(1);
              }}
            >
              <span>Add</span>
              <span aria-live="polite">{formatKES(total)}</span>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" className="h-14 w-full rounded-lg text-base font-bold" disabled>
            {max === 0 ? "Out of stock" : "Not available right now"}
          </Button>
          <p className="text-sm text-muted-foreground">{unavailableReason}</p>
        </div>
      )}
    </div>
  );
}
