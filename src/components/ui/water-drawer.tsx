"use client";

import { cloneElement, isValidElement, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";

interface WaterDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Mobile sidebar with a liquid reveal:
 * 1. panel springs in, 2. a blue tide sheet sweeps away to reveal the menu,
 * 3. ripple rings expand, 4. the header pops down, 5. nav items cascade in.
 * Locks body scroll and closes on Escape.
 */
export function WaterDrawer({ open, onClose, children }: WaterDrawerProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const content =
    isValidElement<{ className?: string }>(children) ? (
      cloneElement(children, { className: cn(children.props.className, "drawer-stagger") })
    ) : (
      children
    );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 lg:hidden"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduce ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.28 }}
        >
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col overflow-hidden rounded-r-3xl bg-white shadow-layered"
            initial={reduce ? { x: 0 } : { x: "-100%" }}
            animate={{ x: 0 }}
            exit={reduce ? { x: 0 } : { x: "-100%" }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 250, damping: 28, mass: 0.9 }
            }
          >
            {/* Ripple rings */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-6 top-24 size-24 rounded-full border-2 border-[#0052FF]/40"
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 1, ease: EASE, delay: reduce ? 0 : 0.18 }}
            />
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-10 top-32 size-14 rounded-full border-2 border-[#0052FF]/30"
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 3.2, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 1.3, ease: EASE, delay: reduce ? 0 : 0.34 }}
            />

            {/* Header */}
            <motion.div
              className="relative flex h-16 shrink-0 items-center justify-between border-b border-border px-5"
              initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.32, ease: EASE, delay: reduce ? 0 : 0.36 }}
            >
              <BrandMark className="scale-90" />
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Close dashboard menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </motion.div>

            {content}

            {/* Tide sheet: covers the drawer then sweeps off to reveal it */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-brand-gradient"
              initial={reduce ? { x: "-102%" } : { x: 0 }}
              animate={{ x: "-102%" }}
              transition={{ duration: reduce ? 0 : 0.55, ease: EASE, delay: reduce ? 0 : 0.12 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/10 to-transparent" />
            </motion.div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}