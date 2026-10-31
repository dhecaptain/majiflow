"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "mf:refillPromptDismissed";

export function RefillPrompt() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    const timer = window.setTimeout(() => setShow(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = (permanent = false) => {
    setShow(false);
    if (permanent) {
      try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-4 z-[80] w-full max-w-sm sm:max-w-md pointer-events-auto"
        style={{ bottom: "var(--notify-bottom)" }}
        role="dialog"
        aria-live="polite"
      >
        <div className="relative overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-[var(--brand-bright)] via-[var(--brand)] to-[var(--brand-deep)] p-5 shadow-accent">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M50 0 L100 50 L50 100 L0 50 Z%22 fill=%22white%22 fill-opacity=%220.05%22/%3E%3C/svg%3E')]" aria-hidden />
          
          <button
            onClick={() => dismiss(true)}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-4" aria-hidden />
          </button>

          <div className="relative flex items-start gap-3">
            <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <Truck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg text-white">Need a refill?</h3>
              <p className="mt-1 text-sm text-white/80">
                Stations near you deliver in under 60 minutes.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
                  <Zap className="size-3" aria-hidden /> Live tracking
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
              <Button
                size="md"
                className="group flex-1 bg-white text-[var(--brand)] hover:bg-white/90"
                onClick={() => { router.push("/browse"); dismiss(true); }}
              >
                Order water
              </Button>
              <Button
                size="md"
                variant="ghost"
                className="flex-1 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => dismiss(false)}
              >
                Not now
              </Button>
            </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}