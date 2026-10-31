"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { ROUTE_PROGRESS } from "@/config/loader";
import { usePrefersReducedMotion } from "@/lib/motion";

type Phase = "idle" | "run" | "done" | "hide";

const listeners = new Set<() => void>();
let requested = false;

/**
 * Called by a route's `loading.tsx` boundary the moment it is shown, which is
 * the earliest honest signal that a navigation is in flight.
 */
export function startRouteProgress(): void {
  requested = true;
  for (const listener of listeners) listener();
}

const variants: Variants = {
  idle: { scaleX: 0, opacity: 0 },
  run: {
    scaleX: 0.92,
    opacity: 1,
    transition: { scaleX: { duration: 2.2, ease: "easeOut" }, opacity: { duration: 0.12 } },
  },
  done: {
    scaleX: 1,
    opacity: 1,
    transition: { scaleX: { duration: 0.22, ease: "easeOut" }, opacity: { duration: 0.12 } },
  },
  hide: {
    scaleX: 1,
    opacity: 0,
    transition: { duration: ROUTE_PROGRESS.fadeMs / 1000, ease: "easeIn" },
  },
};

const reducedVariants: Variants = {
  idle: { scaleX: 0, opacity: 0 },
  run: { scaleX: 1, opacity: 1, transition: { duration: 0 } },
  done: { scaleX: 1, opacity: 1, transition: { duration: 0 } },
  hide: { scaleX: 1, opacity: 0, transition: { duration: 0 } },
};

/**
 * Thin brand-coloured progress bar pinned to the top of the viewport, the way
 * YouTube and GitHub signal that a route is loading.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const reduce = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const timersRef = useRef<number[]>([]);
  const firstPathRef = useRef(true);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const run = useCallback(() => {
    clearTimers();
    setPhase("run");
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    setPhase("done");
    timersRef.current.push(
      window.setTimeout(() => setPhase("hide"), ROUTE_PROGRESS.holdMs),
      window.setTimeout(() => setPhase("idle"), ROUTE_PROGRESS.holdMs + ROUTE_PROGRESS.fadeMs)
    );
  }, [clearTimers]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const listener = () => {
      requested = false;
      if (phaseRef.current === "idle") run();
    };
    listeners.add(listener);
    if (requested) listener();
    return () => {
      listeners.delete(listener);
    };
  }, [run]);

  // The pathname changing means the route committed.
  useEffect(() => {
    if (firstPathRef.current) {
      firstPathRef.current = false;
      return;
    }
    if (phaseRef.current === "idle") {
      // Nothing was pending (a cached route), so show a short sweep anyway.
      run();
      timersRef.current.push(window.setTimeout(finish, 200));
    } else {
      finish();
    }
  }, [pathname, run, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-0 z-[150] origin-left"
      style={{ height: ROUTE_PROGRESS.heightPx }}
      variants={reduce ? reducedVariants : variants}
      initial="idle"
      animate={phase}
      aria-hidden
    >
      <div
        className="h-full w-full"
        style={{ background: "linear-gradient(90deg, var(--brand), var(--aqua))" }}
      />
    </motion.div>
  );
}

/**
 * Drop this inside a route's `loading.tsx` so the top bar starts as soon as
 * the Suspense boundary appears.
 */
export function RouteProgressTrigger() {
  useEffect(() => {
    startRouteProgress();
  }, []);
  return null;
}
