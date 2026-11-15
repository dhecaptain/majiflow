"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CategoryChip {
  id: string;
  label: string;
}

/**
 * Horizontally scrollable category chips that stick under the order bar and
 * highlight the section currently in view (scroll-spy).
 */
export function CategoryChips({
  categories,
  className,
}: {
  categories: CategoryChip[];
  className?: string;
}) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const clickLockRef = useRef<number | null>(null);

  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (clickLockRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0.1, 0.3, 0.6] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  const jump = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    setActive(id);
    clickLockRef.current = window.setTimeout(() => {
      clickLockRef.current = null;
    }, 700);
    const offset = window.matchMedia("(min-width: 1024px)").matches ? 150 : 76;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  if (categories.length <= 1) return null;

  return (
    <div
      className={cn(
        "sticky top-[env(safe-area-inset-top)] z-30 -mx-4 border-b border-[#eef3fa] bg-white/95 px-4 backdrop-blur-md sm:mx-0 sm:px-0 lg:top-[calc(4.5rem+env(safe-area-inset-top))]",
        className
      )}
    >
      <div ref={scrollerRef} className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => jump(c.id)}
            aria-pressed={active === c.id}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
              active === c.id
                ? "border-[var(--brand)] bg-brand-soft text-brand-deep"
                : "border-border bg-white text-foreground hover:border-[var(--brand)]/40"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
