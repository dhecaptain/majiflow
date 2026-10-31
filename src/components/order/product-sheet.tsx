"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Minus, Plus, ShoppingCart, X } from "lucide-react";
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
            className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={panelTransition}
          >
            <div className="relative aspect-[16/9] shrink-0 bg-muted">
              <BlurImage
                src={productImage(product.image)}
                alt={product.name}
                fill
                sizes="(min-width: 640px) 32rem, 100vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-foreground shadow-soft backdrop-blur hover:bg-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <h2 className="font-display text-xl text-foreground">{product.name}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{formatKES(unitPrice)}</span>
                <span className="font-mono text-[11px] uppercase text-muted-foreground">/ {product.unit}</span>
                {product.oldPrice && unitPrice === product.price && (
                  <span className="text-sm text-muted-foreground line-through">{formatKES(product.oldPrice)}</span>
                )}
              </div>

              {options.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold text-foreground">Choose how you want it</legend>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {options.map((option) => {
                      const optionPrice = unitPriceFor(product, option);
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
                            name="product-option"
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
                                : `${formatKES(optionPrice)} each${option.priceDelta < 0 ? ` · ${formatKES(Math.abs(option.priceDelta))} off` : option.priceDelta > 0 ? ` · +${formatKES(option.priceDelta)}` : ""}`}
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

              {requirements.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {requirements.map((r) => (
                    <li key={r.text} className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground/85">
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

              {inCart ? (
                <div className="mt-5 rounded-2xl border border-[var(--brand)]/25 bg-cta-soft/50 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {inCart.quantity} in your order
                  </p>
                  <div className="mt-3">
                    <QtyControl
                      value={inCart.quantity}
                      max={max}
                      onDec={() => updateQuantity(inCart, inCart.quantity - 1)}
                      onInc={() => updateQuantity(inCart, inCart.quantity + 1)}
                      label={product.name}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Quantity</span>
                  <QtyControl
                    value={pick}
                    max={Math.max(1, max)}
                    onDec={() => setQty((q) => Math.max(1, q - 1))}
                    onInc={() => setQty((q) => Math.min(Math.max(1, max), q + 1))}
                    label={product.name}
                  />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {inCart ? (
                <Button size="lg" className="w-full" onClick={onClose}>
                  Done · {formatKES(lineTotal(inCart.quantity))}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={closed || max === 0}
                  onClick={add}
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  {closed ? "Station is closed" : max === 0 ? "Out of stock" : `Add to cart · ${formatKES(lineTotal(pick))}`}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
    "flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-3 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onDec} disabled={value <= 1} aria-label={`Decrease ${label}`} className={cn(btn)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" className="w-10 text-center text-base font-semibold tabular-nums">
        {value}
      </output>
      <button type="button" onClick={onInc} disabled={value >= max} aria-label={`Increase ${label}`} className={cn(btn)}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
