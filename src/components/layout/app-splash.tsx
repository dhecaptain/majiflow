"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WaterLoader } from "@/components/ui/water-loader";
import { MajiMark } from "@/components/layout/maji-mark";

/**
 * Brand splash shown on the very first load while the app hydrates, then fades
 * away. It lives in the root layout, so client-side navigation never shows it.
 */
export function AppSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHidden(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="app-splash fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-background"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-2xl shadow-accent">
              <MajiMark />
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Maji<span className="text-[#0052FF]">Flow</span>
            </span>
          </motion.div>
          <WaterLoader label="Filling up" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
