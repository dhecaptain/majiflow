"use client";

import Link from "next/link";
import { AlertCircle, ChevronLeft, PackageX, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useBottomBarLift } from "@/lib/use-bottom-bar";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { BlurImage } from "@/components/ui/blur-image";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
import { JourneyLink } from "@/components/order/journey";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { SendWaterSummary } from "@/components/order/send-water-summary";
import { useOrderSession } from "@/components/order/order-session-provider";
import { OrderTotalsList } from "@/components/shared/order-totals";
import { useStations } from "@/components/order/stations-provider";
import { itemHref, resolveCart, type CartLine, type ResolvedCartLine } from "@/lib/cart";
import { formatKES } from "@/lib/format";
import { computeCartTotals, lineSubtotal } from "@/lib/pricing";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-border bg-white p-4";

/** Phone top bar: back to the station and a centred title. The shared header takes over from `lg`. */
function CartTopBar({ stationName }: { stationName?: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#eef3fa] bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden">
      <JourneyLink
        step="station"
        aria-label="Back to station"
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-2"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </JourneyLink>
      <div className="mr-[52px] flex min-w-0 flex-1 flex-col items-center text-center">
        <h1 className="text-[17px] font-extrabold tracking-tight text-foreground">Your cart</h1>
        {stationName && <span className="max-w-full truncate text-xs text-muted-foreground">{stationName}</span>}
      </div>
    </div>
  );
}

export function CartPage() {
  const businesses = useStations();
  const { items, hydrated, updateQuantity, removeItem } = useCart();
  const { fulfilment, setFulfilment } = useOrderSession();
  const { toast } = useToast();
  // The phone "Go to checkout" bar owns the bottom of the screen.
  useBottomBarLift(hydrated && items.length > 0);

  const remove = (line: CartLine, name: string) => {
    removeItem(line);
    toast({ kind: "info", title: "Removed from cart", message: name });
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-surface-2">
        <CartTopBar />
        <Container className="py-24">
          <LoadingState label="Loading your cart…" />
        </Container>
      </div>
    );
  }

  const cart = resolveCart(items, businesses);

  if (cart.lines.length === 0) {
    return (
      <div className="min-h-screen bg-surface-2">
        <CartTopBar />
        <Container className="py-16 lg:py-24">
          <h1 className="sr-only lg:not-sr-only lg:mb-6 lg:block lg:text-center lg:text-3xl lg:font-extrabold lg:tracking-tight lg:text-foreground">
            Your cart
          </h1>
          <EmptyState
              className="mx-auto max-w-lg rounded-xl border-solid py-12 [&_h3]:font-sans [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:tracking-tight"
              icon={<ShoppingCart className="size-7" aria-hidden />}
              title="Your cart is empty"
              description="No cans in here yet. Find a trusted station near you and add a refill - it takes seconds."
              action={
                <JourneyLink
                  step="station"
                  className={buttonVariants({
                    size: "lg",
                    className: "rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--cta-hover)]",
                  })}
                >
                  Browse stations
                </JourneyLink>
              }
            />
        </Container>
      </div>
    );
  }

  const pickup = fulfilment === "pickup";
  const priced = cart.orderable.filter((r) => r.max > 0);
  // Collection carries no delivery fee - the same rule checkout applies.
  const totals = computeCartTotals(
    priced.map((r) => ({
      businessId: r.business!.id,
      quantity: Math.min(r.line.quantity, r.max),
      unitPrice: r.unitPrice,
      deposit: r.deposit,
    })),
    pickup ? businesses.map((b) => ({ id: b.id, deliveryFee: 0, freeDeliveryAbove: 0 })) : businesses
  );
  const { total } = totals;
  const freeDeliveryStations = pickup
    ? []
    : totals.groups.filter((group) => group.subtotal > 0 && group.deliveryFee === 0);
  const stationNames = new Map(businesses.map((b) => [b.id, b.name]));
  const { stationBlockers, problems } = cart;
  const removeUnavailable = () => {
    for (const r of problems.filter((p) => p.status === "missing" || p.status === "out-of-stock")) {
      removeItem(r.line);
    }
    toast({ kind: "info", title: "Removed unavailable items" });
  };
  const removable = problems.filter((p) => p.status === "missing" || p.status === "out-of-stock").length;

  const stations = [
    ...new Map(cart.lines.filter((r) => r.business).map((r) => [r.business!.id, r.business!])).values(),
  ];
  const station: Business | undefined = stations[0];
  const singleStation = stations.length === 1;

  // Free-delivery progress: one station, a fee to waive, and a threshold to reach.
  const group = singleStation ? totals.groups[0] : undefined;
  const showProgress =
    !pickup && singleStation && !!station && station.deliveryFee > 0 && station.freeDeliveryAbove > 0 && !!group;
  const progressReached = showProgress && group!.subtotal >= station!.freeDeliveryAbove;
  const progressPct = showProgress ? Math.min(100, Math.round((group!.subtotal / station!.freeDeliveryAbove) * 100)) : 0;

  const payNote =
    cart.orderable.length > 0 && cart.orderable.every((r) => r.business?.acceptsMpesa)
      ? "Pay when it arrives, or with M-Pesa now. You choose at checkout."
      : "Pay when it arrives: cash or M-Pesa to the rider.";

  const cta = (where: "bar" | "side") =>
    cart.canCheckout ? (
      <Link
        href="/checkout"
        className="flex h-14 w-full items-center justify-between gap-3 rounded-lg bg-[var(--brand)] px-[18px] text-base font-bold text-white shadow-accent transition-colors hover:bg-[var(--cta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        <span>Go to checkout</span>
        <span className="font-extrabold">{formatKES(total)}</span>
      </Link>
    ) : (
      <>
        <Button
          size="lg"
          className="h-14 w-full rounded-lg text-base font-bold"
          disabled
          aria-describedby={`checkout-blocked-${where}`}
        >
          Go to checkout
        </Button>
        <p id={`checkout-blocked-${where}`} className="mt-2 text-center text-xs text-danger">
          {problems.length > 0
            ? "Fix the highlighted items to continue."
            : "A station in your cart can't take orders right now."}
        </p>
      </>
    );

  return (
    <div className="min-h-screen bg-surface-2 pb-36 lg:pb-16">
      <CartTopBar stationName={singleStation ? station?.name : undefined} />

      <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6 lg:pt-10">
        <div className="mb-6 hidden items-end justify-between gap-3 lg:flex">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Your cart</h1>
            {singleStation && station && <p className="mt-1 text-sm text-muted-foreground">{station.name}</p>}
          </div>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-3.5">
            {problems.length > 0 && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4"
              >
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

            <section aria-label="Items" className="rounded-xl border border-border bg-white px-4 py-1">
              <ul className="flex flex-col" aria-label="Items in your cart">
                {cart.lines.map((r) => (
                  <CartRow
                    key={`${r.line.businessId}-${r.line.productId}-${r.line.optionId ?? ""}`}
                    row={r}
                    showStation={!singleStation}
                    onQuantity={(n) => updateQuantity(r.line, n)}
                    onRemove={() => remove(r.line, r.product?.name ?? "Unavailable item")}
                  />
                ))}
              </ul>
              <JourneyLink
                step="station"
                className="flex min-h-[52px] items-center gap-2 text-sm font-bold text-[var(--brand)] hover:text-[var(--brand-deep)]"
              >
                <Plus className="size-[18px]" aria-hidden />
                Add more items
              </JourneyLink>
            </section>

            {station && (
              <section aria-labelledby="cart-fulfilment" className={cn(CARD, "flex flex-col gap-3")}>
                <h2 id="cart-fulfilment" className="text-[15px] font-extrabold tracking-tight text-foreground">
                  How do you want it?
                </h2>
                <div role="radiogroup" aria-labelledby="cart-fulfilment" className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "delivery" as const, label: "Delivery", note: `About ${station.avgDeliveryMinutes} min` },
                    {
                      id: "pickup" as const,
                      label: "Pickup",
                      note: station.nearbyDiscountPercent
                        ? `Save ${station.nearbyDiscountPercent}%`
                        : "Collect at the station",
                    },
                  ].map((option) => {
                    const on = fulfilment === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setFulfilment(option.id)}
                        className={cn(
                          "flex min-h-11 flex-col items-start gap-0.5 rounded-md px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                          on
                            ? "border-2 border-[var(--brand)] bg-surface-2"
                            : "border border-border bg-white hover:border-[var(--brand)]/40"
                        )}
                      >
                        <span className="text-[15px] font-bold text-foreground">{option.label}</span>
                        <span className="text-[12.5px] text-muted-foreground">{option.note}</span>
                      </button>
                    );
                  })}
                </div>
                {showProgress && (
                  <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                    <span className={cn("text-[13px] font-semibold", progressReached ? "text-success" : "text-foreground")}>
                      {progressReached
                        ? "You get free delivery on this order"
                        : `Add ${formatKES(station.freeDeliveryAbove - group!.subtotal)} more for free delivery`}
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-border" aria-hidden>
                      <span
                        className={cn(
                          "block h-full rounded-full transition-[width] duration-500",
                          progressReached ? "bg-success" : "bg-aqua"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </span>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Summary: in the flow on a phone, a sticky column with the action on a desktop. */}
          <div className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-24">
            <section aria-labelledby="cart-summary" className={cn(CARD, "flex flex-col gap-3")}>
              <h2 id="cart-summary" className="text-[15px] font-extrabold tracking-tight text-foreground">
                Summary
              </h2>
              <SendWaterSummary />
              <OrderTotalsList
                totals={totals}
                pickup={pickup}
                className="space-y-2.5"
                totalClassName="text-base font-extrabold"
              >
                {totals.groups.length > 1 && (
                  <ul className="space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                    {totals.groups.map((g) => (
                      <li key={g.businessId} className="flex items-center justify-between gap-3">
                        <span className="truncate">{stationNames.get(g.businessId) ?? g.businessId}</span>
                        <span>{g.deliveryFee === 0 ? "Free" : formatKES(g.deliveryFee)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {freeDeliveryStations.length > 0 && !showProgress && (
                  <p className="text-xs text-success">
                    Free delivery from{" "}
                    {freeDeliveryStations.map((g) => stationNames.get(g.businessId) ?? g.businessId).join(", ")}: those
                    items reach the station minimum.
                  </p>
                )}
              </OrderTotalsList>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">{payNote}</p>

              {stationBlockers.length > 0 && (
                <div className="rounded-md border border-danger/30 bg-danger-soft p-3" role="alert">
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

              <div className="mt-1 hidden lg:block">
                {cta("side")}
                <p className="mt-3 text-center text-xs text-muted-foreground">Next: contact, delivery & payment</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Phone: the action stays under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        {cta("bar")}
      </div>
    </div>
  );
}

function CartRow({
  row,
  showStation,
  onQuantity,
  onRemove,
}: {
  row: ResolvedCartLine;
  showStation: boolean;
  onQuantity: (n: number) => void;
  onRemove: () => void;
}) {
  const { line, business, product, option, status, problem, max } = row;

  if (!business || !product) {
    return (
      <li className="flex items-center gap-3 border-b border-[#eef3fa] py-3.5">
        <span className="flex size-[60px] shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
          <PackageX className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-foreground">Item unavailable</p>
          <p className="mt-0.5 text-xs text-danger">{problem}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden /> Remove
        </button>
      </li>
    );
  }

  const href = itemHref(business.slug, product.id);
  return (
    <li className="flex flex-col gap-2 border-b border-[#eef3fa] py-3.5">
      <div className="flex items-center gap-3">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className={cn(
            "relative size-[60px] shrink-0 overflow-hidden rounded-md bg-surface-2",
            status !== "ok" && "ring-2 ring-danger/40"
          )}
        >
          <BlurImage src={productImage(product.image)} alt="" fill sizes="60px" className="object-cover" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={href}
            className="truncate text-[15px] font-bold text-foreground hover:text-[var(--brand)] hover:underline"
          >
            {product.name}
          </Link>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {option ? `${option.label} · ` : ""}
            {formatKES(row.unitPrice)} / {product.unit}
          </span>
          {showStation && (
            <Link href={`/browse/${business.slug}#menu`} className="truncate text-xs text-muted-foreground hover:underline">
              {business.name} · {business.city}
            </Link>
          )}
          <span className="mt-0.5 flex items-center gap-1">
            <span className="whitespace-nowrap text-sm font-extrabold text-foreground">
              {formatKES(lineSubtotal(row.unitPrice, Math.min(line.quantity, max)))}
            </span>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${product.name} from cart`}
              className="-my-3 ml-1 inline-flex min-h-11 items-center gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </button>
          </span>
        </div>
        {status === "out-of-stock" ? (
          <span className="shrink-0 rounded-md bg-surface-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
            Out of stock
          </span>
        ) : (
          <QuantityStepper
            value={line.quantity}
            min={0}
            max={Math.max(max, line.quantity)}
            label={product.name}
            size="sm"
            onChange={onQuantity}
            className="shrink-0 gap-0 rounded-md bg-surface-2 p-0 [&_output]:w-6 [&_output]:font-extrabold"
          />
        )}
      </div>
      {(row.deposit > 0 || problem || status === "over-stock") && (
        <div className="flex flex-wrap items-center justify-between gap-2 pl-[72px]">
          <div className="min-w-0">
            {row.deposit > 0 && (
              <p className="text-xs text-muted-foreground">+ {formatKES(row.deposit)} refundable deposit</p>
            )}
            {problem && <p className="text-xs font-medium text-danger">{problem}</p>}
          </div>
          {status === "over-stock" && (
            <Button variant="secondary" size="sm" onClick={() => onQuantity(max)}>
              Set to {max}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
