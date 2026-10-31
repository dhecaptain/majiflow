"use client";

import Link from "next/link";
import { Droplets, AlertCircle, ArrowLeft, PackageX, ShoppingCart, Trash2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { BlurImage } from "@/components/ui/blur-image";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
import { JourneyLink } from "@/components/order/journey";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { SendWaterSummary } from "@/components/order/send-water-summary";
import { OrderTotalsList } from "@/components/shared/order-totals";
import { businesses } from "@/lib/data/businesses";
import { itemHref, resolveCart, type CartLine, type ResolvedCartLine } from "@/lib/cart";
import { formatKES } from "@/lib/format";
import { computeCartTotals, lineSubtotal } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function CartPage() {
  const { items, hydrated, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();

  const remove = (line: CartLine, name: string) => {
    removeItem(line);
    toast({ kind: "info", title: "Removed from cart", message: name });
  };

  if (!hydrated) {
    return (
      <Container className="py-24">
        <LoadingState label="Loading your cart…" />
      </Container>
    );
  }

  const cart = resolveCart(items, businesses);

  if (cart.lines.length === 0) {
    return (
      <Container className="py-24">
        <h1 className="sr-only">Your cart</h1>
        <EmptyState
          icon={<ShoppingCart className="size-7" aria-hidden />}
          title="Your cart is empty"
          description="No cans in here yet. Find a trusted station near you and add a refill - it takes seconds."
          action={
            <JourneyLink step="station" className={buttonVariants({ size: "lg" })}>
              Browse stations
            </JourneyLink>
          }
        />
      </Container>
    );
  }

  const priced = cart.orderable.filter((r) => r.max > 0);
  const totals = computeCartTotals(
    priced.map((r) => ({
      businessId: r.business!.id,
      quantity: Math.min(r.line.quantity, r.max),
      unitPrice: r.unitPrice,
      deposit: r.deposit,
    })),
    businesses
  );
  const { total } = totals;
  const freeDeliveryStations = totals.groups.filter(
    (group) => group.subtotal > 0 && group.deliveryFee === 0
  );
  const stationNames = new Map(businesses.map((b) => [b.id, b.name]));
  const { stationBlockers, problems } = cart;
  const removeUnavailable = () => {
    for (const r of problems.filter((p) => p.status === "missing" || p.status === "out-of-stock")) {
      removeItem(r.line);
    }
    toast({ kind: "info", title: "Removed unavailable items" });
  };
  const removable = problems.filter((p) => p.status === "missing" || p.status === "out-of-stock").length;

  return (
    <>
      <Container className="py-14 lg:py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-foreground animate-pulse-dot" /> Your order
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
            Review your cart
          </h1>
        </div>
        <JourneyLink
          step="station"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Keep shopping
        </JourneyLink>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="flex flex-col gap-4">
          {problems.length > 0 && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                {problems.length === 1 ? "1 item needs" : `${problems.length} items need`} your attention before
                checkout.
              </p>
              {removable > 0 && (
                <Button variant="secondary" size="sm" onClick={removeUnavailable}>
                  Remove unavailable
                </Button>
              )}
            </div>
          )}
          <ul className="flex flex-col gap-4" aria-label="Items in your cart">
            {cart.lines.map((r) => (
              <CartRow
                key={`${r.line.businessId}-${r.line.productId}-${r.line.optionId ?? ""}`}
                row={r}
                onQuantity={(n) => updateQuantity(r.line, n)}
                onRemove={() => remove(r.line, r.product?.name ?? "Unavailable item")}
              />
            ))}
          </ul>
        </div>

        {/* Summary */}
        <div className="h-fit rounded-2xl border border-border bg-white p-6 shadow-layered lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-foreground">Order summary</h2>
          <OrderTotalsList totals={totals} className="mt-5">
            {totals.groups.length > 1 && (
              <ul className="space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                {totals.groups.map((group) => (
                  <li key={group.businessId} className="flex items-center justify-between gap-3">
                    <span className="truncate">{stationNames.get(group.businessId) ?? group.businessId}</span>
                    <span>{group.deliveryFee === 0 ? "Free" : formatKES(group.deliveryFee)}</span>
                  </li>
                ))}
              </ul>
            )}
            {freeDeliveryStations.length > 0 && (
              <p className="text-xs text-success">
                Free delivery from{" "}
                {freeDeliveryStations
                  .map((group) => stationNames.get(group.businessId) ?? group.businessId)
                  .join(", ")}
                : those items reach the station minimum.
              </p>
            )}
          </OrderTotalsList>

          <SendWaterSummary className="mt-4" />

          <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-xs text-success">
            <Droplets className="size-4 shrink-0" aria-hidden />
            Payment is collected with M-Pesa before dispatch.
          </p>

          {stationBlockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3" role="alert">
              {stationBlockers.map((b) => (
                <p key={b.businessId} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  <span>
                    <strong>{b.businessName}:</strong> {b.reason}
                  </span>
                </p>
              ))}
              <p className="mt-2 text-xs text-muted-foreground">
                Remove these items or wait for opening hours - checkout will not accept them.
              </p>
            </div>
          )}

          {cart.canCheckout ? (
            <Link
              href="/checkout"
              className={buttonVariants({
                size: "lg",
                className: "mt-5 w-full bg-[var(--brand)] text-white shadow-accent hover:bg-[var(--cta-hover)]",
              })}
            >
              Continue to checkout · {formatKES(total)}
            </Link>
          ) : (
            <>
              <Button size="lg" className="mt-5 w-full" disabled aria-describedby="checkout-blocked">
                Continue to checkout
              </Button>
              <p id="checkout-blocked" className="mt-2 text-center text-xs text-danger">
                {problems.length > 0
                  ? "Fix the highlighted items to continue."
                  : "A station in your cart can't take orders right now."}
              </p>
            </>
          )}
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            1 of 2 · Next: delivery & payment
          </p>
        </div>
      </div>
      </Container>
    </>
  );
}

function CartRow({
  row,
  onQuantity,
  onRemove,
}: {
  row: ResolvedCartLine;
  onQuantity: (n: number) => void;
  onRemove: () => void;
}) {
  const { line, business, product, option, status, problem, max } = row;

  if (!business || !product) {
    return (
      <li className="flex items-center gap-4 rounded-2xl border border-dashed border-danger/40 bg-white p-4 sm:p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <PackageX className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">Item unavailable</p>
          <p className="mt-0.5 text-xs text-danger">{problem}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden /> Remove
        </button>
      </li>
    );
  }

  const href = itemHref(business.slug, product.id);
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-card sm:flex-nowrap sm:p-5",
        status === "ok" ? "border-border" : "border-danger/40"
      )}
    >
      <Link href={href} tabIndex={-1} aria-hidden className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        <BlurImage src={productImage(product.image)} alt="" fill sizes="3.5rem" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-[15px] font-semibold text-foreground hover:text-[var(--brand)] hover:underline">
          {product.name}
        </Link>
        {option && (
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--brand)]">{option.label}</p>
        )}
        <Link href={`/browse/${business.slug}#menu`} className="mt-0.5 block text-xs text-muted-foreground hover:underline">
          {business.name} · {business.city}
        </Link>
        <p className="mt-1 text-sm font-bold text-foreground">
          {formatKES(row.unitPrice)} <span className="font-normal text-muted-foreground">/ {product.unit}</span>
        </p>
        {row.deposit > 0 && (
          <p className="text-xs text-muted-foreground">
            + {formatKES(row.deposit)} refundable deposit
          </p>
        )}
        {problem && <p className="mt-1 text-xs font-medium text-danger">{problem}</p>}
      </div>

      <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
        {status === "out-of-stock" ? (
          <span className="text-sm font-medium text-muted-foreground">Out of stock</span>
        ) : (
          <QuantityStepper value={line.quantity} min={0} max={Math.max(max, line.quantity)} label={product.name} onChange={onQuantity} size="sm" />
        )}
        {status === "over-stock" && (
          <Button variant="secondary" size="sm" onClick={() => onQuantity(max)}>
            Set to {max}
          </Button>
        )}
        <div className="w-24 text-right">
          <p className="text-sm font-bold text-foreground">
            {formatKES(lineSubtotal(row.unitPrice, Math.min(line.quantity, max)))}
          </p>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${product.name} from cart`}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}
