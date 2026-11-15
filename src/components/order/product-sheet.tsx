"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Minus, Plus, X } from "lucide-react";
import type { Business, BusinessProduct, ProductOption } from "@/lib/types";
import { maxOrderQuantity, productRequirements, unitPriceFor } from "@/lib/cart";
import { lineDeposit, lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { productImage } from "@/lib/product-images";
import { cn } from "@/lib/utils";
import { BlurImage } from "@/components/ui/blur-image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/components/order/cart-provider";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { useMotionSafe } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface ProductSheetProps {
  business: Business;
  product: BusinessProduct | null;
  open: boolean;
  onClose: () => void;
  initialQuantity?: number;
}

/**
 * Bottom sheet (mobile) / centred card (desktop) for a product: image, the
 * choices the station offers (swap your can, new can, dispenser + can),
 * quantity and a live-priced Add button.
 */
export function ProductSheet({ business, product, open, onClose, initialQuantity = 1 }: ProductSheetProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartUi = useOptionalCartUi();
  const { toast } = useToast();
  const { reduce, transition } = useMotionSafe();
  const availability = useBusinessAvailability(business.openingHours);
  const [qty, setQty] = useState(1);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);

  const options = useMemo(() => product?.options ?? [], [product]);
  // The default is the first choice the station can actually fill, so a quick
  // add never lands on something out of stock.
  const defaultOptionId = options.find((o) => (o.stock ?? product?.stock ?? 0) > 0)?.id ?? options[0]?.id ?? null;
  const selectedOption: ProductOption | undefined = options.find((o) => o.id === optionId) ?? (defaultOptionId ? options.find((o) => o.id === defaultOptionId) : undefined);

  const max = product ? maxOrderQuantity(product, selectedOption) : 0;
  const unitPrice = product ? unitPriceFor(product, selectedOption) : 0;
  const deposit = selectedOption?.deposit ?? 0;
  const lineTotal = (qty: number) => lineSubtotal(unitPrice, qty) + lineDeposit(deposit, qty);
  const inCart = product
    ? items.find(
        (i) =>
          i.businessId === business.id &&
          i.productId === product.id &&
          (i.optionId ?? undefined) === (selectedOption?.id ?? undefined)
      )
    : undefined;
  const closed = availability.state !== "open";
  const requirements = useMemo(
    () => (product ? productRequirements(product, business) : []),
    [product, business]
  );

  // Reset the quantity whenever a different item is opened (React's
  // "adjust state during render" pattern - no effect needed).
  const openKey = open && product ? `${business.id}:${product.id}` : null;
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey !== null) {
      setQty(Math.max(1, Math.floor(initialQuantity)));
      setOptionId(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const overlayTransition = reduce ? { duration: 0 } : { duration: 0.2 };
  const panelTransition = reduce ? { duration: 0 } : (transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] });
  const pick = Math.min(qty, Math.max(1, max));

  const add = () => {
    if (!product) return;
    const line = {
      businessId: business.id,
      productId: product.id,
      quantity: pick,
      ...(selectedOption ? { optionId: selectedOption.id } : {}),
    };
    if (cartUi) cartUi.requestAdd(line);
    else addItem(line);
    toast({ kind: "success", title: "Added to cart", message: `${pick} × ${product.name}` });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
        >
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            className="relative z-10 flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={panelTransition}
          >
            <div className="relative h-[210px] shrink-0 bg-brand-soft">
              <BlurImage
                src={productImage(product.image)}
                alt={product.name}
                fill
                sizes="(min-width: 640px) 32rem, 100vw"
                className={cn("object-cover", max === 0 && "grayscale")}
              />
              <span
                aria-hidden
                className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/20 sm:hidden"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3.5 top-3.5 flex size-11 items-center justify-center rounded-full bg-white text-foreground shadow-soft transition-colors hover:bg-surface-2"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-5 pt-[18px] sm:px-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-foreground">{product.name}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-base font-extrabold text-foreground">{formatKES(unitPrice)}</span>
                  <span className="text-xs font-medium text-muted-foreground">/ {product.unit}</span>
                  {product.oldPrice && unitPrice === product.price && (
                    <span className="text-xs font-medium text-muted-foreground line-through">{formatKES(product.oldPrice)}</span>
                  )}
                </p>
              </div>

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
                      name="product-option"
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

              {requirements.length > 0 && (
                <ul className="space-y-2">
                  {requirements.map((r) => (
                    <li key={r.text} className="flex items-start gap-2.5 rounded-md bg-surface-2 p-3 text-[13px] leading-relaxed text-foreground/85">
                      <Info className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                      <span>
                        {r.text}
                        {r.alternative && (
                          <> Try the {r.alternative.name} ({formatKES(r.alternative.price)}) if you have no empty can.</>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {inCart && (
                <p className="text-sm font-semibold text-[var(--brand)]">{inCart.quantity} in your order</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-[#eef3fa] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3.5 sm:px-5">
              {inCart ? (
                <>
                  <QtyControl
                    value={inCart.quantity}
                    max={max}
                    onDec={() => updateQuantity(inCart, inCart.quantity - 1)}
                    onInc={() => updateQuantity(inCart, inCart.quantity + 1)}
                    label={product.name}
                  />
                  <Button size="lg" className={addButtonClass} onClick={onClose}>
                    <span>Done</span>
                    <span>{formatKES(lineTotal(inCart.quantity))}</span>
                  </Button>
                </>
              ) : closed || max === 0 ? (
                <Button size="lg" className={cn(addButtonClass, "[&>span]:justify-center")} disabled>
                  {closed ? "Station is closed" : "Out of stock"}
                </Button>
              ) : (
                <>
                  <QtyControl
                    value={pick}
                    max={Math.max(1, max)}
                    onDec={() => setQty((q) => Math.max(1, q - 1))}
                    onInc={() => setQty((q) => Math.min(Math.max(1, max), q + 1))}
                    label={product.name}
                  />
                  <Button size="lg" className={addButtonClass} onClick={add}>
                    <span>Add</span>
                    <span>{formatKES(lineTotal(pick))}</span>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The 56px brand button in the sheet footer: action on the left, live total on the right. */
const addButtonClass =
  "h-14 min-w-0 flex-1 rounded-lg px-[18px] text-base font-bold hover:translate-y-0 [&>span]:w-full [&>span]:justify-between";

/** Heading over a product's choices: refills are always about the can. */
export function productOptionsLegend(product: BusinessProduct) {
  return product.category === "refill" ? "Your can" : "Choose one";
}

/**
 * One choice for a product as a radio card: custom dot on the left, price on
 * the right, any refundable deposit as a note. Wraps a real (visually hidden)
 * radio, so keyboard and screen-reader behaviour stay native.
 */
export function ProductOptionCard({
  name,
  product,
  option,
  selected,
  onSelect,
}: {
  name: string;
  product: BusinessProduct;
  option: ProductOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const optionPrice = unitPriceFor(product, option);
  const soldOut = maxOrderQuantity(product, option) === 0;
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand)]",
        selected
          ? "border-2 border-[var(--brand)] bg-surface-2 p-[13px]"
          : "border border-border bg-white p-3.5 hover:border-[var(--brand)]/40",
        soldOut && "cursor-not-allowed opacity-60 hover:border-border"
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={selected}
        disabled={soldOut}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-[var(--brand)]" : "border-[#9fb3c8]"
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-[var(--brand)]" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold leading-snug text-foreground">{option.label}</span>
        <span className="text-[13px] text-muted-foreground">
          {soldOut
            ? "Out of stock"
            : `${formatKES(optionPrice)} each${option.priceDelta < 0 ? ` · ${formatKES(Math.abs(option.priceDelta))} off` : option.priceDelta > 0 ? ` · +${formatKES(option.priceDelta)}` : ""}`}
        </span>
        {option.deposit ? (
          <span className="text-[13px] font-medium text-[var(--brand)]">
            + {formatKES(option.deposit)} refundable deposit
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-bold text-foreground">{formatKES(optionPrice)}</span>
    </label>
  );
}

function QtyControl({
  value,
  max,
  onDec,
  onInc,
  label,
}: {
  value: number;
  max: number;
  onDec: () => void;
  onInc: () => void;
  label: string;
}) {
  const btn =
    "flex h-full w-12 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex h-14 shrink-0 items-center rounded-lg border border-border">
      <button type="button" onClick={onDec} disabled={value <= 1} aria-label={`Decrease ${label}`} className={cn(btn, "text-foreground")}>
        <Minus className="size-5" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-6 text-center text-[17px] font-extrabold tabular-nums">
        {value}
      </output>
      <button type="button" onClick={onInc} disabled={value >= max} aria-label={`Increase ${label}`} className={cn(btn, "text-[var(--brand)]")}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}
