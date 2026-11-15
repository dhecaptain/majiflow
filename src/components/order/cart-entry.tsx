"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Repeat2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStations } from "@/components/order/stations-provider";
import { resolveCart } from "@/lib/cart";
import { computeCartTotals } from "@/lib/pricing";
import { formatKES } from "@/lib/format";
import { useMotionSafe } from "@/lib/motion";
import { useCart } from "@/components/order/cart-provider";
import { useCartUi } from "@/components/order/cart-ui-provider";

/**
 * Persistent bottom cart bar shown everywhere a drawer can open. Hidden while
 * the drawer itself is open so the two never stack.
 */
export function FloatingCartBar() {
  const businesses = useStations();
  const { items, hydrated } = useCart();
  const { open, openCart } = useCartUi();
  const { reduce, transition } = useMotionSafe();
  const pathname = usePathname();

  const cart = resolveCart(items, businesses);
  const count = cart.lines.reduce((n, r) => n + r.line.quantity, 0);
  const totals = computeCartTotals(
    cart.orderable
      .filter((r) => r.max > 0)
      .map((r) => ({
        businessId: r.business!.id,
        quantity: Math.min(r.line.quantity, r.max),
        unitPrice: r.unitPrice,
        deposit: r.deposit,
      })),
    businesses
  );

  // Station pages, cart, checkout and tracking own their own summary bars;
  // sign-in and sign-up stay focused on the form.
  const hiddenRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname?.startsWith("/order/") === true ||
    pathname?.startsWith("/browse/") === true;
  const visible = hydrated && count > 0 && !open && !hiddenRoute;

  // Gentle bounce every time something is added.
  const prevCountRef = useRef(count);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (count > prevCountRef.current) setBounceKey((k) => k + 1);
    prevCountRef.current = count;
  }, [count]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 bottom-[max(calc(var(--tabbar-h)+0.75rem),calc(0.75rem+env(safe-area-inset-bottom)))] z-40 px-4 lg:bottom-6"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={reduce ? { duration: 0 } : (transition ?? { duration: 0.3 })}
        >
          <motion.button
            key={bounceKey}
            type="button"
            onClick={openCart}
            initial={reduce ? false : { scale: 1 }}
            animate={reduce ? undefined : { scale: [1, 1.035, 1] }}
            whileHover={reduce ? undefined : { scale: 1.01 }}
            whileTap={reduce ? undefined : { scale: 0.99 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-label={`View cart: ${count} ${count === 1 ? "item" : "items"}, ${formatKES(totals.total)}`}
            className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 rounded-lg bg-[var(--brand)] px-4 text-left text-white shadow-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-white/20 px-1.5 text-sm font-extrabold">
              {count}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold">
              <ShoppingBag className="size-5 shrink-0" aria-hidden />
              View cart
            </span>
            <span className="text-base font-extrabold">{formatKES(totals.total)}</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Confirmation shown when adding an item from a different station than the one
 * already in the cart. Nothing is cleared until the customer chooses to.
 */
export function SwitchStationDialog() {
  const { pendingSwitch, confirmSwitch, cancelSwitch } = useCartUi();
  const { reduce } = useMotionSafe();

  return (
    <AnimatePresence>
      {pendingSwitch && (
        <motion.div
          className="fixed inset-0 z-[96] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={cancelSwitch} aria-hidden />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="switch-title"
            aria-describedby="switch-desc"
            className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-cta-soft text-[var(--brand)]">
              <Repeat2 className="size-6" aria-hidden />
            </span>
            <h2 id="switch-title" className="mt-4 text-lg font-extrabold tracking-tight text-foreground">
              Start a new order?
            </h2>
            <p id="switch-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your order is with {pendingSwitch.currentBusinessName}. Each order comes from one station, so
              adding {pendingSwitch.businessName} starts a new order and clears what&apos;s in your cart now.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <Button className="flex-1" onClick={confirmSwitch}>
                Start new order
              </Button>
              <Button variant="outline" className="flex-1" onClick={cancelSwitch}>
                Keep current order
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
