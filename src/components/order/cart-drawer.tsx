"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, PackageX, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

import { ButtonLoader } from "@/components/ui/button-loader";
import { cn } from "@/lib/utils";
import { productImage } from "@/lib/product-images";
import { useStations } from "@/components/order/stations-provider";
import { itemHref, resolveCart } from "@/lib/cart";
import { computeCartTotals, lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { useMotionSafe } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useCart } from "@/components/order/cart-provider";
import { useCartUi } from "@/components/order/cart-ui-provider";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { SendWaterSummary } from "@/components/order/send-water-summary";
import { OrderTotalsList } from "@/components/shared/order-totals";

/**
 * Slide-in cart: right panel on desktop, bottom sheet on mobile. Reuses the
 * same resolution + pricing rules as the cart page so nothing drifts.
 */
export function CartDrawer() {
  const businesses = useStations();
  const { items, hydrated, updateQuantity, removeItem } = useCart();
  const { open, closeCart } = useCartUi();
  const { reduce, transition } = useMotionSafe();
  const panelRef = useFocusTrap<HTMLElement>(open);

  // A modal: Escape closes it and the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeCart]);

  const panelTransition = reduce ? { duration: 0 } : (transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] });
  const cart = resolveCart(items, businesses);
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
  const count = cart.lines.reduce((n, r) => n + r.line.quantity, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-end sm:items-stretch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={closeCart} aria-hidden />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-h-none sm:h-full sm:max-w-md sm:rounded-none"
            initial={reduce ? { opacity: 1 } : { x: 0, y: 60 }}
            animate={{ x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { x: 0, y: 40 }}
            transition={panelTransition}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-[#eef3fa] px-5 py-3">
              <h2 className="min-w-0 flex-1 text-[17px] font-extrabold tracking-tight text-foreground">
                Your cart
                {count > 0 && <span className="text-muted-foreground"> · {count}</span>}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            {!hydrated ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
                <ButtonLoader className="size-8" />
                Loading your order…
              </div>
            ) : cart.lines.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-[var(--brand)]">
                    <ShoppingCart className="size-7" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="text-[17px] font-extrabold tracking-tight text-foreground">Your cart is empty</p>
                    <p className="text-sm text-muted-foreground">
                      Add items to start your order again.
                    </p>
                  </div>
                  <Link href="/browse" onClick={closeCart} className={buttonVariants({ size: "lg", className: "rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--cta-hover)]" })}>
                    Browse menu
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-4 py-4">
                  {cart.problems.length > 0 && (
                    <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-foreground">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                      {cart.problems.length === 1 ? "1 item needs" : `${cart.problems.length} items need`} your
                      attention before checkout.
                    </div>
                  )}
                  <ul className="flex flex-col rounded-xl border border-border bg-white px-4 py-1" aria-label="Items in your order">
                    {cart.lines.map((r) => {
                      const { line, business, product, option, status, problem, max } = r;
                      if (!business || !product) {
                        return (
                          <li key={`${line.businessId}-${line.productId}-${line.optionId ?? ""}`} className="flex items-center gap-3 border-b border-[#eef3fa] py-3.5 last:border-0">
                            <span className="flex size-[60px] shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                              <PackageX className="size-5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-bold text-foreground">Item unavailable</p>
                              <p className="text-xs text-danger">{problem}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(line)}
                              aria-label="Remove unavailable item"
                              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-danger"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li
                          key={`${line.businessId}-${line.productId}-${line.optionId ?? ""}`}
                          className="flex flex-col gap-1.5 border-b border-[#eef3fa] py-3.5 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <Link
                              href={itemHref(business.slug, product.id)}
                              onClick={closeCart}
                              className={cn(
                                "relative size-[60px] shrink-0 overflow-hidden rounded-md bg-surface-2",
                                status !== "ok" && "ring-2 ring-danger/40"
                              )}
                            >
                              <Image src={productImage(product.image)} alt="" fill sizes="60px" className="object-cover" />
                            </Link>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <p className="truncate text-[15px] font-bold text-foreground">{product.name}</p>
                              {option && (
                                <p className="truncate text-[12.5px] text-muted-foreground">{option.label}</p>
                              )}
                              <p className="truncate text-xs text-muted-foreground">
                                {business.name} · {business.city}
                              </p>
                              <span className="mt-0.5 text-sm font-extrabold text-foreground">
                                {formatKES(lineSubtotal(r.unitPrice, Math.min(line.quantity, max)))}
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
                                className="shrink-0 gap-0.5 rounded-md bg-surface-2 p-0 [&_output]:font-extrabold"
                                onChange={(n) => updateQuantity(line, n)}
                              />
                            )}
                          </div>
                          {(problem || r.deposit > 0) && (
                            <div className="pl-[72px]">
                              {problem && <p className="text-xs font-medium text-danger">{problem}</p>}
                              {r.deposit > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  + {formatKES(r.deposit * Math.min(line.quantity, max))} refundable deposit
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <footer className="shrink-0 border-t border-border bg-white px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <SendWaterSummary className="mb-3" />
                  <OrderTotalsList
                    totals={totals}
                    className="space-y-2"
                    totalClassName="text-base font-extrabold"
                  />

                  {cart.canCheckout ? (
                    <Link
                      href="/checkout"
                      onClick={closeCart}
                      className="mt-4 flex h-14 w-full items-center justify-between gap-3 rounded-lg bg-[var(--brand)] px-[18px] text-base font-bold text-white shadow-accent transition-colors hover:bg-[var(--cta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    >
                      <span>Go to checkout</span>
                      <span className="font-extrabold">{formatKES(totals.total)}</span>
                    </Link>
                  ) : (
                    <>
                      <Button size="lg" className="mt-4 h-14 w-full rounded-lg text-base font-bold" disabled aria-describedby="drawer-blocked">
                        Go to checkout
                      </Button>
                      <p id="drawer-blocked" className="mt-2 text-center text-xs text-danger">
                        Fix the highlighted items to continue.
                      </p>
                    </>
                  )}
                  <Link
                    href="/cart"
                    onClick={closeCart}
                    className="mt-1 flex min-h-11 items-center justify-center text-sm font-bold text-[var(--brand)] hover:text-[var(--brand-deep)]"
                  >
                    View full cart
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
