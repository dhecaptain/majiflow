"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, MapPin, PackageCheck, ShoppingBag, Store } from "lucide-react";
import type { Business, BusinessProduct } from "@/lib/types";
import {
  cartLineKey,
  maxOrderQuantity,
  optionFor,
  type CartLine,
} from "@/lib/cart";
import { resolveCart } from "@/lib/cart";
import { computeCartTotals, lineSubtotal, lineDeposit } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { businesses } from "@/lib/data/businesses";
import { productImage } from "@/lib/product-images";
import { cn } from "@/lib/utils";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { useBrowseContext } from "@/components/order/browse-context";
import { ProductSheet } from "@/components/order/product-sheet";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { BlurImage } from "@/components/ui/blur-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { BrowseOrderChoice, BrowseWaterCategory } from "@/components/order/browse-context";

const ORDER_CATEGORIES: {
  id: BrowseWaterCategory;
  title: string;
  description: string;
  image: string;
}[] = [
  { id: "refills", title: "Refill a can", description: "Top up a container you already own.", image: "can" },
  { id: "new-bottles", title: "New bottle", description: "Choose a sealed, ready-to-use bottle.", image: "bottle" },
  { id: "bottled-packs", title: "Bottle packs", description: "Small bottles and multipacks for home.", image: "glass" },
  { id: "dispensers", title: "Dispensers", description: "Find a dispenser for your home or office.", image: "dispenser" },
];

function matchesCategory(product: BusinessProduct, category: BrowseWaterCategory): boolean {
  if (category === "refills") return product.category === "refill";
  if (category === "dispensers") return product.category === "dispenser";
  if (product.category !== "bottled") return false;
  return category === "new-bottles" ? product.unit === "can" : product.unit !== "can";
}

function addressLabel(address: Parameters<typeof formatAddress>[0]): string {
  return formatAddress(address);
}

function formatAddress(address: { street?: string; estate?: string; city?: string; label?: string } | null): string {
  if (!address) return "";
  return [address.street, address.estate, address.city].filter(Boolean).join(", ") || address.label || "";
}

export function BrowseOrderStep({
  choice,
  onChoice,
  onContinue,
}: {
  choice: BrowseOrderChoice;
  onChoice: (choice: Partial<BrowseOrderChoice>) => void;
  onContinue: () => void;
}) {
  const sizeOptions = useMemo(() => {
    if (!choice.category) return [];
    const unique = new Map<string, { name: string; unit: string }>;
    for (const business of businesses) {
      for (const product of business.products) {
        if (!matchesCategory(product, choice.category)) continue;
        const key = product.name.trim().toLocaleLowerCase();
        if (key && !unique.has(key)) unique.set(key, { name: product.name, unit: product.unit });
      }
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [choice.category]);

  const ready = Boolean(choice.category && choice.size && choice.quantity > 0);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Step 1 · Order</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
          What would you like?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Choose a water type, then select the size and quantity that suits you.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER_CATEGORIES.map((category) => {
          const active = choice.category === category.id;
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => onChoice({ category: category.id, size: null })}
              aria-pressed={active}
              className={cn(
                "group flex min-h-28 items-center gap-4 rounded-xl border bg-white p-4 text-left transition-colors hover:border-brand/50",
                active ? "border-brand ring-2 ring-brand/15" : "border-border"
              )}
            >
              <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                <BlurImage src={productImage(category.image)} alt="" fill sizes="4rem" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{category.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{category.description}</span>
              </span>
              {active ? <Check className="size-5 shrink-0 text-brand" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {choice.category ? (
        <div className="mt-8 rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Choose a size</h2>
              <p className="mt-1 text-sm text-muted-foreground">Options are based on products listed by our stations.</p>
            </div>
            {choice.size ? (
              <span className="rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">Size selected</span>
            ) : null}
          </div>

          {sizeOptions.length ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sizeOptions.map((size) => {
                const active = choice.size === size.name;
                return (
                  <button
                    type="button"
                    key={`${size.name}:${size.unit}`}
                    onClick={() => onChoice({ size: size.name })}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      active ? "border-brand bg-brand/5 font-semibold text-brand" : "border-border text-foreground hover:border-brand/40"
                    )}
                  >
                    <span>{size.name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">{size.unit}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              No sizes are listed for this water type yet. Choose another type to continue.
            </p>
          )}

          {choice.size ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Quantity</p>
                <p className="mt-1 text-xs text-muted-foreground">You can adjust it again when you add items to your cart.</p>
              </div>
              <QuantityStepper
                value={choice.quantity}
                onChange={(quantity) => onChoice({ quantity })}
                label={choice.size}
                min={1}
                max={20}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 flex justify-end">
        <Button size="lg" disabled={!ready} onClick={onContinue}>
          Continue to location <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

export function BrowseLocationStep({
  address,
  onOpenLocation,
  onContinue,
  canContinue,
}: {
  address: { street?: string; estate?: string; city?: string; label?: string } | null;
  onOpenLocation: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const selectedAddress = addressLabel(address);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Step 2 · Map/Location</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">Where should we deliver?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Search for an address, choose a saved place, or move the pin to your exact location.
        </p>
      </div>

      <Card className="mt-7 grid overflow-hidden border-border md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <div className="p-5 sm:p-7">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <MapPin className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold text-foreground">Delivery location</h2>
          {selectedAddress ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground">{selectedAddress}</p>
          ) : (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Your location helps us show the closest stations and their delivery estimates.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" onClick={onOpenLocation}>
              <MapPin className="size-4" aria-hidden /> {selectedAddress ? "Change location" : "Set your location"}
            </Button>
            {selectedAddress ? (
              <Button size="lg" variant="outline" onClick={onOpenLocation}>Edit on map</Button>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">The map lets you drag the pin after searching or using your current location.</p>
        </div>
        <div className="flex min-h-52 flex-col justify-center border-t border-border bg-surface-2 p-5 md:border-l md:border-t-0 sm:p-7">
          <div className="flex size-12 items-center justify-center rounded-full bg-white text-brand shadow-soft">
            <Store className="size-5" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Nearby stations come next</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Set a delivery point to compare stations that serve your area.</p>
          <Button className="mt-5 w-full" size="lg" variant="secondary" disabled={!canContinue} onClick={onContinue}>
            Continue to stations <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </Card>
    </section>
  );
}

export function BrowseCartStep({
  station,
  cart,
  preferredSize,
  preferredQuantity,
  onChooseStation,
}: {
  station: Business | null;
  cart: CartLine[];
  preferredSize: string | null;
  preferredQuantity: number;
  onChooseStation: () => void;
}) {
  const router = useRouter();

  if (!station) {
    return (
      <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand"><Store className="size-8" aria-hidden /></span>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">Choose a station first</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Select a station to see its products and build your order.</p>
        <Button size="lg" className="mt-5" onClick={onChooseStation}>Browse stations</Button>
      </section>
    );
  }

  const stationCart = cart.filter((line) => line.businessId === station.id);
  const resolved = resolveCart(stationCart, [station]);
  const cartStationMatches = !cart.length || cart.every((line) => line.businessId === station.id);
  const pricedLines = resolved.orderable
    .filter((line) => line.status === "ok" && line.max > 0)
    .map((line) => ({
      businessId: station.id,
      quantity: Math.min(line.line.quantity, line.max),
      unitPrice: line.unitPrice,
      deposit: line.deposit,
    }));
  const totals = computeCartTotals(pricedLines, [station]);
  const canCheckout = stationCart.length > 0 && cartStationMatches && resolved.canCheckout;

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Step 4 · Add to Cart</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">{station.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose products from this station. Your order stays saved as you move between steps.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground">
          <MapPin className="size-4 text-brand" aria-hidden /> {station.estates[0] ?? station.city}, {station.city}
        </div>
      </div>

      {preferredSize ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg bg-brand/5 px-3 py-2.5 text-sm text-foreground">
          <PackageCheck className="size-4 shrink-0 text-brand" aria-hidden />
          <span>Your selection: <strong>{preferredSize}</strong> · quantity {preferredQuantity}</span>
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          {station.products.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
              {[...station.products]
                .sort((a, b) => Number(b.name === preferredSize) - Number(a.name === preferredSize))
                .map((product) => (
                  <BrowseProductCard
                    key={product.id}
                    business={station}
                    product={product}
                    initialQuantity={product.name === preferredSize ? preferredQuantity : 1}
                  />
                ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <ShoppingBag className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <h2 className="mt-3 font-display text-lg font-bold text-foreground">No products listed yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">Try another station to see available water products.</p>
            </Card>
          )}
        </div>

        <CartSummary
          station={station}
          lines={resolved.lines}
          totals={totals}
          canCheckout={canCheckout}
          cartStationMatches={cartStationMatches}
          onCheckout={() => router.push("/checkout")}
        />
      </div>
    </section>
  );
}

function BrowseProductCard({
  business,
  product,
  initialQuantity,
}: {
  business: Business;
  product: BusinessProduct;
  initialQuantity: number;
}) {
  const { cart: items, addToCart: addItem, updateCartQuantity: updateQuantity } = useBrowseContext();
  const cartUi = useOptionalCartUi();
  const { toast } = useToast();
  const availability = useBusinessAvailability(business.openingHours);
  const [sheetOpen, setSheetOpen] = useState(false);
  const lines = items.filter((line) => line.businessId === business.id && line.productId === product.id);
  const baseMax = maxOrderQuantity(product);
  const hasOptions = Boolean(product.options?.length);
  const closed = availability.state !== "open";
  const unavailable = baseMax === 0 || closed;

  const add = () => {
    if (unavailable) return;
    if (hasOptions) {
      setSheetOpen(true);
      return;
    }
    const quantity = Math.max(1, Math.min(baseMax, initialQuantity));
    const line: CartLine = { businessId: business.id, productId: product.id, quantity };
    if (cartUi) cartUi.requestAdd(line);
    else addItem(line);
    toast({ kind: "success", title: "Added to cart", message: `${quantity} × ${product.name}` });
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border transition-shadow hover:shadow-layered">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
        <BlurImage
          src={productImage(product.image)}
          alt={product.name}
          fill
          sizes="(min-width: 1536px) 18rem, (min-width: 768px) 30vw, 92vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.popular ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow-soft">Popular</span> : null}
        {baseMax === 0 ? <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-danger shadow-soft">Out of stock</span> : null}
      </div>
      <div className="flex flex-1 flex-col items-center p-4 text-center sm:p-5">
        <h2 className="line-clamp-2 min-h-11 text-base font-bold leading-snug text-foreground">{product.name}</h2>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{product.description}</p>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="text-lg font-bold tracking-tight text-foreground">{formatKES(product.price)}</span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">/ {product.unit}</span>
        </div>
        <div className="mt-4 flex w-full flex-col items-center gap-2">
          {lines.length ? (
            lines.map((line) => {
              const option = optionFor(product, line.optionId);
              const max = maxOrderQuantity(product, option);
              return (
                <div key={cartLineKey(line)} className="flex w-full flex-col items-center gap-1">
                  {lines.length > 1 && option ? <span className="text-[10px] text-muted-foreground">{option.label}</span> : null}
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(quantity) => updateQuantity(line, quantity)}
                    label={option ? `${product.name}, ${option.label}` : product.name}
                    min={0}
                    max={max}
                    size="sm"
                    className="w-full justify-center"
                  />
                </div>
              );
            })
          ) : (
            <Button
              size="sm"
              disabled={unavailable}
              onClick={add}
              className="h-10 min-h-10 w-full max-w-48 rounded-full px-4"
            >
              {closed ? "Station closed" : baseMax === 0 ? "Out of stock" : "+ Add to Cart"}
            </Button>
          )}
          {hasOptions && lines.length === 0 && !unavailable ? (
            <span className="text-[10px] text-muted-foreground">Choose a product option after tapping</span>
          ) : null}
        </div>
      </div>
      <ProductSheet
        business={business}
        product={product}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialQuantity={initialQuantity}
      />
    </Card>
  );
}

function CartSummary({
  station,
  lines,
  totals,
  canCheckout,
  cartStationMatches,
  onCheckout,
}: {
  station: Business;
  lines: ReturnType<typeof resolveCart>["lines"];
  totals: ReturnType<typeof computeCartTotals>;
  canCheckout: boolean;
  cartStationMatches: boolean;
  onCheckout: () => void;
}) {
  const count = lines.reduce((total, line) => total + line.line.quantity, 0);
  const blocker = lines.find((line) => line.status !== "ok")?.problem;

  return (
    <aside className="xl:sticky xl:top-[calc(6rem+env(safe-area-inset-top))]">
      <Card className="overflow-hidden border-border">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Your cart</h2>
            <p className="mt-1 text-xs text-muted-foreground">{station.name} · {count} {count === 1 ? "item" : "items"}</p>
          </div>
          <ShoppingBag className="size-5 text-brand" aria-hidden />
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {lines.length ? (
            lines.map((line) => (
              <div key={cartLineKey(line.line)} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{line.product?.name ?? "Unavailable item"}</span>
                  {line.option ? <span className="block text-xs text-muted-foreground">{line.option.label}</span> : null}
                  <span className="text-xs text-muted-foreground">Qty {line.line.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold text-foreground">
                  {formatKES(lineSubtotal(line.unitPrice, line.line.quantity) + lineDeposit(line.deposit, line.line.quantity))}
                </span>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm leading-relaxed text-muted-foreground">Add a product to see your order summary here.</p>
          )}

          {!cartStationMatches ? (
            <p className="rounded-lg bg-warning-soft p-3 text-xs leading-relaxed text-foreground">
              Your cart has items from another station. Choose that station or confirm a station change when adding an item.
            </p>
          ) : null}
          {blocker ? <p className="rounded-lg bg-danger-soft p-3 text-xs leading-relaxed text-danger">{blocker}</p> : null}

          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <SummaryRow label="Items" value={formatKES(totals.subtotal)} />
            <SummaryRow label="Delivery" value={totals.deliveryFee === 0 && count ? "Free" : formatKES(totals.deliveryFee)} />
            {totals.deposit > 0 ? <SummaryRow label="Refundable deposit" value={formatKES(totals.deposit)} /> : null}
            <SummaryRow label="Total" value={formatKES(totals.total)} bold />
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={!canCheckout}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Checkout <ChevronRight className="size-4" aria-hidden />
          </button>
          {!count ? <p className="text-center text-[11px] text-muted-foreground">Your cart is empty.</p> : null}
        </div>
      </Card>
    </aside>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", bold ? "font-bold text-foreground" : "text-muted-foreground")}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}
