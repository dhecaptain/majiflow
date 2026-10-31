import Link from "next/link";
import { cn } from "@/lib/utils";
import { MajiMark } from "@/components/layout/maji-mark";

export function BrandMark({
  className,
  dark,
  showTagline = false,
  compact = false,
}: {
  className?: string;
  dark?: boolean;
  showTagline?: boolean;
  /** Tighter icon and wordmark for the fixed header, matching kfc.ke's proportions. */
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="MajiFlow home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden shadow-accent transition-transform duration-300 group-hover:scale-105",
          compact ? "size-8 rounded-lg" : "size-9 rounded-xl"
        )}
      >
        <MajiMark />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            compact ? "text-base" : "text-lg",
            dark ? "text-background" : "text-foreground"
          )}
        >
          Maji
          <span className="text-[var(--brand)]">Flow</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              dark ? "text-background/50" : "text-muted-foreground"
            )}
          >
            Water, delivered
          </span>
        )}
      </span>
    </Link>
  );
}
