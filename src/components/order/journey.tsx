"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { safeJourneyHref, JOURNEY_FALLBACK, type JourneyStep } from "@/lib/journey";

const KEY_PREFIX = "mf:journey:";
const listeners = new Set<() => void>();

export function rememberJourneyStep(step: JourneyStep, href: string) {
  try {
    window.sessionStorage.setItem(KEY_PREFIX + step, href);
  } catch {
    /* storage unavailable - links fall back to their defaults */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function read(step: JourneyStep): string {
  try {
    return safeJourneyHref(step, window.sessionStorage.getItem(KEY_PREFIX + step));
  } catch {
    return JOURNEY_FALLBACK[step];
  }
}

export function useJourneyHref(step: JourneyStep): string {
  return useSyncExternalStore(
    subscribe,
    () => read(step),
    () => JOURNEY_FALLBACK[step]
  );
}

/** Records the page it renders on as the latest point in the journey. */
export function JourneyRecorder({ step, href }: { step: JourneyStep; href: string }) {
  useEffect(() => {
    rememberJourneyStep(step, href);
  }, [step, href]);
  return null;
}

export function JourneyLink({
  step,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  step: JourneyStep;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const href = useJourneyHref(step);
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
