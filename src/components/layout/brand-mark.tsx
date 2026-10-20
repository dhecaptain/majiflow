import Link from "next/link";
import { cn } from "@/lib/utils";
import { MajiMark } from "@/components/layout/maji-mark";

export function BrandMark({
  className,
  dark,
  showTagline = false,
}: {
  className?: string;
  dark?: boolean;
  showTagline?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="MajiFlow home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0052FF]",
        className
      )}
    >
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl shadow-accent transition-transform duration-300 group-hover:scale-105">
        <MajiMark />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-lg font-semibold tracking-tight",
            dark ? "text-background" : "text-foreground"
          )}
        >
          Maji
          <span className="text-[#0052FF]">Flow</span>
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
