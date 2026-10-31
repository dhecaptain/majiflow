"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import type { Business, BusinessProduct, ProductOption } from "@/lib/types";
import { businesses } from "@/lib/data/businesses";
import { maxOrderQuantity, resolveCart, unitPriceFor } from "@/lib/cart";
import { lineDeposit, lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/components/order/cart-provider";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { SkeletonCard } from "@/components/ui/skeleton-card";

/** Quantity, line total and the next step for the item being viewed. */
export function ItemPurchasePanel({ business, product }: { business: Business; product: BusinessProduct }) {
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
      <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> In your cart
        </p>
        {selectedOption && (
          <p className="mt-1 text-xs font-medium text-[var(--brand)]">{selectedOption.label}</p>
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
          {options.length > 0 && (
            <fieldset className="mb-4">
              <legend className="text-sm font-semibold text-foreground">Choose how you want it</legend>
              <div className="mt-2 flex flex-col gap-2">
                {options.map((option) => {
                  const optionMax = maxOrderQuantity(product, option);
                  const selected = selectedOption?.id === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                        selected
                          ? "border-[var(--brand)] bg-cta-soft/40"
                          : "border-border bg-white hover:border-[var(--brand)]/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="purchase-option"
                        className="sr-only"
                        checked={selected}
                        disabled={optionMax === 0}
                        onChange={() => {
                          setOptionId(option.id);
                          setQty(1);
                        }}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                          selected ? "border-[var(--brand)]" : "border-border"
                        )}
                      >
                        {selected && <span className="size-2 rounded-full bg-[var(--brand)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {optionMax === 0
                            ? "Out of stock"
                            : `${formatKES(unitPriceFor(product, option))} each${
                                option.priceDelta < 0
                                  ? ` · ${formatKES(Math.abs(option.priceDelta))} off`
                                  : option.priceDelta > 0
                                    ? ` · +${formatKES(option.priceDelta)}`
                                    : ""
                              }`}
                        </span>
                        {option.deposit ? (
                          <span className="mt-0.5 block text-xs font-medium text-[var(--brand)]">
                            + {formatKES(option.deposit)} refundable deposit
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper value={pick} max={max} label={product.name} onChange={setQty} />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Total{" "}
              <strong className="text-lg text-foreground">
                {formatKES(lineSubtotal(unitPrice, pick) + lineDeposit(deposit, pick))}
              </strong>
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Up to {max} per order{max < 20 ? ` - ${max} left in stock` : ""}.
            {deposit > 0 ? ` Includes a ${formatKES(deposit)} refundable deposit per unit.` : ""}
          </p>
          <Button
            size="lg"
            className="mt-4 w-full"
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
            <ShoppingCart className="size-4" aria-hidden /> Add to cart ·{" "}
            {formatKES(lineSubtotal(unitPrice, pick) + lineDeposit(deposit, pick))}
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
