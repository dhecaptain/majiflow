"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  GlassWater,
  MapPin,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJourneyHref } from "@/components/order/journey";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useCart } from "@/components/order/cart-provider";
import { useMotionSafe } from "@/lib/motion";

interface JourneyStepDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

const STEPS: JourneyStepDef[] = [
  { id: "location", label: "Location", icon: MapPin },
  { id: "station", label: "Station", icon: Store },
  { id: "menu", label: "Menu", icon: GlassWater },
  { id: "cart", label: "Cart", icon: ShoppingCart },
  { id: "checkout", label: "Checkout", icon: Wallet },
  { id: "track", label: "Track", icon: Truck },
];

/** Route → index of the step the customer is on; null outside the journey. */
function journeyActiveIndex(pathname: string, locationSet: boolean): number | null {
  if (pathname === "/browse") return locationSet ? 1 : 0;
  if (/^\/browse\/[^/]+/.test(pathname)) return 2;
  if (pathname === "/cart") return 3;
  if (pathname === "/checkout") return 4;
  if (/^\/order\/[^/]+/.test(pathname)) return 5;
  return null;
}

export function JourneyStepper() {
  const pathname = usePathname();
  const { address, fulfilment, hydrated } = useOrderSession();
  const { count } = useCart();
  const browseHref = useJourneyHref("browse");
  const stationHref = useJourneyHref("station");
  const { reduce } = useMotionSafe();

  const locationSet = hydrated && (fulfilment === "pickup" || Boolean(address));
  const active = useMemo(
    () => journeyActiveIndex(pathname, locationSet),
    [pathname, locationSet]
  );

  // Only render inside the ordering journey - landing and marketing pages are untouched.
  if (active === null) return null;

  const stepHrefs: (string | null)[] = [
    "/browse",
    browseHref,
    stationHref,
    "/cart",
    // Checkout is only "done" while tracking; going back there is never correct.
    active > 4 ? null : "/checkout",
    null,
  ];

  // An emptied cart is not a completed step while still at checkout; once
  // tracking an order the cart is legitimately empty again.
  const effectiveActive =
    active === 4 && hydrated && count === 0 ? 3 : active;

  return (
    <nav aria-label="Order progress" className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center px-4 py-2.5 lg:px-8">
        {/* Mobile: compact dot rail with a back affordance and the current step. */}
        <ol className="flex w-full items-center gap-1.5 sm:hidden" aria-label="Order steps">
          {STEPS.map((step, i) => {
            const done = i < effectiveActive;
            const current = i === effectiveActive;
            const href = stepHrefs[i];
            const dot = (
              <span
                aria-hidden
                className={cn(
                  "block size-2 rounded-full transition-colors",
                  done
                    ? "bg-[var(--brand)]"
                    : current
                      ? "bg-[var(--brand)]/40 ring-2 ring-[var(--brand)]"
                      : "bg-muted-foreground/25"
                )}
              />
            );
            return (
              <li key={step.id} className="flex items-center gap-1.5">
                {current && (
                  <span className="sr-only">Step {i + 1} of {STEPS.length}: {step.label}</span>
                )}
                {done && href ? (
                  <Link
                    href={href}
                    aria-label={`Back to ${step.label}`}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-brand/5 active:bg-brand/10"
                  >
                    {dot}
                  </Link>
                ) : (
                  <span className="flex size-6 items-center justify-center" aria-current={current ? "step" : undefined}>
                    {dot}
                  </span>
                )}
              </li>
            );
          })}
          <li className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {effectiveActive + 1}/{STEPS.length}
            </span>
            {STEPS[effectiveActive]?.label}
          </li>
        </ol>

        {/* Desktop: full rail - completed steps are tappable. */}
        <ol className="hidden w-full items-center sm:flex" aria-label="Order steps">
          {STEPS.map((step, i) => {
            const done = i < effectiveActive;
            const current = i === effectiveActive;
            const href = stepHrefs[i];
            const Icon = step.icon;
            return (
              <li key={step.id} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                {done && href ? (
                  <Link
                    href={href}
                    aria-label={`Back to ${step.label}`}
                    className="group flex items-center gap-2 rounded-full px-1 py-1"
                  >
                    <StepChip icon={Icon} done current={false} />
                    <span className="text-xs font-semibold text-[var(--brand)] group-hover:text-[var(--brand-deep)]">
                      {step.label}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                    <StepChip icon={Icon} done={false} current={current} />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        current ? "text-foreground" : "text-muted-foreground/70"
                      )}
                    >
                      {step.label}
                    </span>
                  </span>
                )}
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="mx-2 h-0.5 min-w-4 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-[var(--brand)]"
                      initial={false}
                      animate={{ scaleX: done ? 1 : 0 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function StepChip({ icon: Icon, done, current }: { icon: LucideIcon; done: boolean; current: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
        done
          ? "bg-[var(--brand)] text-white"
          : current
            ? "bg-cta-soft text-[var(--brand)] ring-2 ring-[var(--brand)]"
            : "bg-muted text-muted-foreground/70"
      )}
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
    </span>
  );
}
