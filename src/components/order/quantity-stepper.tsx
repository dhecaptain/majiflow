"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Item name, used to label the controls for screen readers. */
  label: string;
  min?: number;
  max: number;
  /** Shown instead of the bare number, e.g. "2 in cart". */
  display?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Quantity control with 44px touch targets that never exceeds what the station can fill. */
export function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
  max,
  display,
  size = "md",
  className,
}: QuantityStepperProps) {
  const button = cn(
    "flex items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground",
    size === "sm" ? "size-10" : "size-11"
  );
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn("flex items-center gap-1 rounded-lg border border-border bg-white p-1", className)}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={min === 0 && value === 1 ? `Remove ${label}` : `Decrease ${label} quantity`}
        className={button}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn("text-center text-sm font-semibold tabular-nums", display ? "min-w-16 flex-1" : "w-8")}
      >
        {display ?? value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label} quantity`}
        className={button}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
