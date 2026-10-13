"use client";

import Link from "next/link";
import Image from "next/image";
import { Droplets, AlertCircle, Minus, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/feedback";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
import { businesses } from "@/lib/data/businesses";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";
import { formatKES } from "@/lib/format";
import { computeCartTotals } from "@/lib/pricing";

export function CartPage() {
  const { items, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();

  const remove = (businessId: string, productId: string, name: string) => {
    removeItem(businessId, productId);
    toast({ kind: "info", title: "Removed from cart", message: name });
  };

  const rows = items
    .map((line) => {
      const business = businesses.find((b) => b.id === line.businessId);
      const product = business?.products.find((p) => p.id === line.productId);
      return { line, business, product };
    })
    .filter((r) => r.business && r.product);

  if (rows.length === 0) {
    return (
      <Container className="py-24">
        <EmptyState
          icon={<ShoppingCart className="size-7" aria-hidden />}
          title="Your cart is empty"
          description="No cans in here yet. Find a trusted station near you and add a refill - it takes seconds."
          action={
            <Link href="/browse">
              <Button size="lg" className="group">
                Browse stations
              </Button>
            </Link>
          }
        />
      </Container>
    );
  }

  const totals = computeCartTotals(
    rows.map((r) => ({
      businessId: r.business!.id,
      quantity: r.line.quantity,
      unitPrice: r.product!.price,
    })),
    businesses
  );
  const { subtotal, deliveryFee, total } = totals;
  const freeDeliveryStations = totals.groups.filter(
    (group) => group.subtotal > 0 && group.deliveryFee === 0
  );
  const stationNames = new Map(businesses.map((b) => [b.id, b.name]));
  const stationById = new Map(businesses.map((b) => [b.id, b]));
  const stationBlockers = totals.groups
    .map((group) => {
      const business = stationById.get(group.businessId);
      const reason = business ? getBusinessOrderBlockReason(business) : "This station is no longer available.";
      return reason ? { businessId: group.businessId, name: business?.name ?? group.businessId, reason } : null;
    })
    .filter((b): b is { businessId: string; name: string; reason: string } => b !== null);

  return (
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
        <Link href="/browse" className="text-sm font-semibold text-[#0052FF] hover:underline">
          Keep shopping
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="flex flex-col gap-4">
          {rows.map(({ line, business, product }) => (
            <div
              key={`${line.businessId}-${line.productId}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5"
            >
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                <Image
                  src={productImage(product!.image)}
                  alt=""
                  className="size-full object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-foreground">{product!.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {business!.name} · {business!.city}
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {formatKES(product!.price)}{" "}
                  <span className="font-normal text-muted-foreground">/ {product!.unit}</span>
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
                <button
                  onClick={() => updateQuantity(line.businessId, line.productId, line.quantity - 1)}
                  aria-label={`Decrease quantity of ${product!.name}`}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums">
                  {line.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(line.businessId, line.productId, line.quantity + 1)}
                  aria-label={`Increase quantity of ${product!.name}`}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              <div className="w-20 text-right">
                <p className="text-sm font-bold text-foreground">
                  {formatKES((product?.price ?? 0) * line.quantity)}
                </p>
                <button
                  onClick={() => remove(line.businessId, line.productId, product!.name)}
                  aria-label={`Remove ${product!.name} from cart`}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="h-fit rounded-2xl border border-border bg-white p-6 shadow-layered lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-foreground">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-semibold text-foreground">{formatKES(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Truck className="size-4" aria-hidden /> Delivery
              </dt>
              <dd className="font-semibold text-foreground">
                {deliveryFee === 0 ? <span className="text-success">Free</span> : formatKES(deliveryFee)}
              </dd>
            </div>
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
            <div className="flex items-center justify-between border-t border-border pt-3">
              <dt className="font-semibold text-foreground">Total</dt>
              <dd className="font-display text-2xl text-foreground">{formatKES(total)}</dd>
            </div>
          </dl>

          <p className="mt-4 flex items-center gap-2 rounded-lg bg-transparent-soft/70 px-3 py-2.5 text-xs text-success">
            <Droplets className="size-4 shrink-0" aria-hidden />
            Payment is collected with M-Pesa before dispatch.
          </p>

          {stationBlockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3" role="alert">
              {stationBlockers.map((b) => (
                <p key={b.businessId} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  <span>
                    <strong>{b.name}:</strong> {b.reason}
                  </span>
                </p>
              ))}
              <p className="mt-2 text-xs text-muted-foreground">
                Remove these items or wait for opening hours - checkout will not accept them.
              </p>
            </div>
          )}

          <Link href="/checkout" className="mt-5 block">
            <Button size="lg" className="group w-full bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_14px_-4px_rgb(249,115,22)]">
              Continue to checkout
            </Button>
          </Link>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            1 of 2 · Next: delivery & payment
          </p>
        </div>
      </div>
    </Container>
  );
}