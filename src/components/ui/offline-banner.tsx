"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/online";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * A slim strip under the fixed header when the connection drops. Nothing is
 * lost: the cart and order session are already persisted locally.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const reduce = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          key="offline"
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.25 }}
          className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-center text-xs font-medium text-background md:top-[calc(5.625rem+env(safe-area-inset-top))]"
        >
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          You&apos;re offline — your cart is saved. We&apos;ll reconnect automatically.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
