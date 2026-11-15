import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Small eyebrow above the title. */
  label?: string;
  /** Retained for call-site compatibility. */
  pulseLabel?: boolean;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
  /** Max width for title + description block. */
  maxWidth?: string;
}

/** Section title on inner pages: an eyebrow, a bold sans heading and one line of copy. */
export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  tone = "light",
  className,
  maxWidth = "max-w-2xl",
}: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-2", align === "center" && "items-center text-center", className)}>
      {label && (
        <p className={cn("text-xs font-bold uppercase tracking-[0.12em]", dark ? "text-[var(--footer-sky)]" : "text-[var(--brand)]")}>
          {label}
        </p>
      )}
      <h2
        className={cn(
          "text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px] lg:text-[32px]",
          dark ? "text-white" : "text-foreground",
          maxWidth
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cn("text-[15px] leading-relaxed sm:text-base", dark ? "text-slate-300" : "text-muted-foreground", maxWidth)}>
          {description}
        </p>
      )}
    </div>
  );
}
