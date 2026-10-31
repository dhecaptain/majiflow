"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, PackageX, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

import { ButtonLoader } from "@/components/ui/button-loader";
import { cn } from "@/lib/utils";
import { productImage } from "@/lib/product-images";
import { businesses } from "@/lib/data/businesses";
import { itemHref, resolveCart } from "@/lib/cart";
import { computeCartTotals, lineSubtotal } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { useMotionSafe } from "@/lib/motion";
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
  const { items, hydrated, updateQuantity, removeItem } = useCart();
  const { open, closeCart } = useCartUi();
  const { reduce, transition } = useMotionSafe();

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
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-none sm:h-full sm:max-w-md sm:rounded-none"
            initial={reduce ? { opacity: 1 } : { x: 0, y: 60 }}
            animate={{ x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { x: 0, y: 40 }}
            transition={panelTransition}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
              <h2 className="min-w-0 flex-1 font-display text-lg text-foreground">
                Here is your order
                {count > 0 && <span className="text-muted-foreground"> · {count}</span>}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
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
                  <ShoppingCart className="size-10 text-muted-foreground" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-display text-lg text-foreground">Here is your order</p>
                    <p className="text-sm text-muted-foreground">
                      Your cart is empty. Add items to start your order again.
                    </p>
                  </div>
                  <Link href="/browse" onClick={closeCart} className={buttonVariants({ size: "lg" })}>
                    Browse menu
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {cart.problems.length > 0 && (
                    <div role="alert" className="mb-3 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-xs text-foreground">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                      {cart.problems.length === 1 ? "1 item needs" : `${cart.problems.length} items need`} your
                      attention before checkout.
                    </div>
                  )}
                  <ul className="flex flex-col gap-3" aria-label="Items in your order">
                    {cart.lines.map((r) => {
                      const { line, business, product, option, status, problem, max } = r;
                      if (!business || !product) {
                        return (
                          <li key={`${line.businessId}-${line.productId}-${line.optionId ?? ""}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-danger/40 p-3">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <PackageX className="size-5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">Item unavailable</p>
                              <p className="text-xs text-danger">{problem}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(line)}
                              aria-label="Remove unavailable item"
                              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li
                          key={`${line.businessId}-${line.productId}-${line.optionId ?? ""}`}
                          className={cn("flex gap-3 rounded-2xl border bg-white p-3", status === "ok" ? "border-border" : "border-danger/40")}
                        >
                          <Link href={itemHref(business.slug, product.id)} onClick={closeCart} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <Image src={productImage(product.image)} alt="" fill sizes="4rem" className="object-cover" />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                            {option && (
                              <p className="truncate text-xs font-medium text-[var(--brand)]">{option.label}</p>
                            )}
                            <p className="truncate text-xs text-muted-foreground">
                              {business.name} · {business.city}
                            </p>
                            {problem && <p className="mt-0.5 text-xs font-medium text-danger">{problem}</p>}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {status === "out-of-stock" ? (
                                <span className="text-xs font-medium text-muted-foreground">Out of stock</span>
                              ) : (
                                <QuantityStepper
                                  value={line.quantity}
                                  min={0}
                                  max={Math.max(max, line.quantity)}
                                  label={product.name}
                                  size="sm"
                                  onChange={(n) => updateQuantity(line, n)}
                                />
                              )}
                              <span className="text-sm font-bold text-foreground">
                                {formatKES(lineSubtotal(r.unitPrice, Math.min(line.quantity, max)))}
                              </span>
                            </div>
                            {r.deposit > 0 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                + {formatKES(r.deposit * Math.min(line.quantity, max))} refundable deposit
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <footer className="shrink-0 border-t border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <SendWaterSummary className="mb-3" />
                  <OrderTotalsList
                    totals={totals}
                    className="space-y-1.5"
                    totalClassName="font-display text-xl"
                  />

                  {cart.canCheckout ? (
                    <Link
                      href="/checkout"
                      onClick={closeCart}
                      className={buttonVariants({ size: "lg", className: "mt-4 w-full" })}
                    >
                      Checkout · {formatKES(totals.total)} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : (
                    <>
                      <Button size="lg" className="mt-4 w-full" disabled aria-describedby="drawer-blocked">
                        Checkout
                      </Button>
                      <p id="drawer-blocked" className="mt-2 text-center text-xs text-danger">
                        Fix the highlighted items to continue.
                      </p>
                    </>
                  )}
                  <Link
                    href="/cart"
                    onClick={closeCart}
                    className="mt-2 block text-center text-xs font-semibold text-[var(--brand)] hover:underline"
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
