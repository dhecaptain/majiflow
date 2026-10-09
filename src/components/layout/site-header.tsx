"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { Menu, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { useCart } from "@/components/order/cart-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { useMotionSafe } from "@/lib/motion";

export const NAV_LINKS = [
  { href: "/browse", label: "Browse water" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-business", label: "For businesses" },
] as const;

/** Routes where the cart belongs — the ordering flow only. */
const ORDER_FLOW = ["/browse", "/cart", "/checkout", "/order"] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { count } = useCart();
  const { profile } = useCustomer();
  const isLoggedIn = Boolean(profile.name);
  const { reduce, transition } = useMotionSafe();
  const inOrderFlow = ORDER_FLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navTransition: Transition = transition ?? { duration: 0.32, ease: [0.16, 1, 0.3, 1] };
  const itemTransition: Transition = reduce ? { duration: 0 } : { delay: 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || menuOpen
          ? "border-b border-border bg-background/85 backdrop-blur-md shadow-soft"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[72rem] items-center justify-between gap-4 px-5 sm:px-8">
        <BrandMark />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname !== "/" && pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors min-h-11 inline-flex items-center",
                  active
                    ? "text-[#0052FF]"
                    : "text-foreground/80 hover:text-[#0052FF] hover:bg-[#0052FF]/5"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {inOrderFlow && (
            <Link
              href="/cart"
              aria-label={`Cart, ${count} items`}
              className="relative flex size-11 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingCart className="size-5" aria-hidden />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white shadow-accent">
                  {count}
                </span>
              )}
            </Link>
          )}

          {isLoggedIn ? (
            <Link href="/account" className="hidden sm:inline-flex">
              <Button variant="ghost" className="min-h-11">
                My account
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-flex">
                <Button variant="ghost" className="min-h-11">
                  Sign in
                </Button>
              </Link>
              <Link href="/register" className="hidden sm:inline-flex">
                <Button className="group min-h-11">
                  Order water
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </Button>
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex size-11 items-center justify-center rounded-lg border border-border bg-white text-foreground lg:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            initial={reduce ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            transition={navTransition}
            className="overflow-hidden border-b border-border bg-background lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 pb-6 pt-2">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...itemTransition, delay: 0.04 * i }}
                >
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-foreground hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="mt-4 flex flex-col gap-2.5">
                {isLoggedIn ? (
                  <Link href="/account" className="w-full">
                    <Button size="lg" className="w-full">
                      My account
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/register" className="w-full">
                      <Button size="lg" className="group w-full">
                        Order water <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                      </Button>
                    </Link>
                    <Link href="/login" className="w-full">
                      <Button size="lg" variant="secondary" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}