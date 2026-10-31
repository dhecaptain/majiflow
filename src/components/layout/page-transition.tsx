"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Whether this tab has already shown a page. The first page arrives
 * server-rendered and fully visible (fading it in would hide content until
 * JavaScript loads); only later client-side navigations fade.
 */
let shownFirstPage = false;

/** Soft fade between routes so navigation feels smooth. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = usePrefersReducedMotion();
  const fade = shownFirstPage && !reduce;

  useEffect(() => {
    shownFirstPage = true;
  }, []);

  return (
    <motion.div
      key={pathname}
      initial={fade ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
