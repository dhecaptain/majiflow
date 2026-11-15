import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  /** Short eyebrow above the title, e.g. "Pricing". */
  label?: string;
  /** Kept for call-site compatibility; the eyebrow no longer pulses. */
  pulseLabel?: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Actions under the description (buttons, a toggle). */
  children?: ReactNode;
  /** Optional panel beside the copy from `lg` up (stats, a contact card). Stacks under it on a phone. */
  aside?: ReactNode;
  tone?: "light" | "dark";
  /** Kept for call-site compatibility; headers are always left-aligned now. */
  align?: "center" | "left";
  className?: string;
}

/**
 * Compact header for inner pages: eyebrow, title, one line of copy and the
 * page's main actions. It deliberately stays short so the page's real content
 * starts on the first screen instead of after a full-height hero.
 */
export function PageHero({ label, title, description, children, aside, tone = "light", className }: PageHeroProps) {
  const dark = tone === "dark";
  return (
    <section
      className={cn(
        "border-b",
        dark ? "border-white/10 bg-foreground text-white" : "border-[#eef3fa] bg-surface-2",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-8 sm:px-6 lg:py-12",
          aside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-12"
        )}
      >
        <div className="flex flex-col gap-3">
          {label && (
            <p className={cn("text-[13px] font-bold uppercase tracking-[0.12em]", dark ? "text-[var(--footer-sky)]" : "text-[var(--brand)]")}>
              {label}
            </p>
          )}
          <h1
            className={cn(
              "max-w-3xl font-display text-[30px] font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[44px]",
              dark ? "text-white" : "text-foreground"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className={cn("max-w-2xl text-[15px] leading-relaxed sm:text-lg", dark ? "text-[#cbe7ff]" : "text-muted-foreground")}>
              {description}
            </p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

/** A page section on the same 1200px grid as the header and the app pages. */
export function PageSection({
  children,
  id,
  className,
  tinted = false,
  narrow = false,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Light blue band to separate it from the section before. */
  tinted?: boolean;
  /** Narrower column for reading (FAQs, prose). */
  narrow?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-10 lg:py-16", tinted && "bg-surface-2", className)}>
      <div className={cn("mx-auto w-full px-4 sm:px-6", narrow ? "max-w-[860px]" : "max-w-[1200px]")}>{children}</div>
    </section>
  );
}
