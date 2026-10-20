"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Accessible, styled city picker (replaces the native select in the hero). */
export function CitySelect({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-white px-4 text-left text-sm font-medium text-foreground transition-colors hover:border-[#0052FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0052FF]"
      >
        <MapPin className="size-5 shrink-0 text-[#0052FF]" aria-hidden />
        <span className="flex-1 truncate">{value}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose your city"
          className="absolute top-[calc(100%+8px)] left-0 z-40 w-full overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-layered"
        >
          {CITIES.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === value}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  c === value ? "font-semibold text-[#0052FF]" : "text-foreground"
                )}
              >
                {c}
                {c === value && <Check className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
