import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import { CountUp } from "@/components/ui/count-up";

interface StatCardProps {
  icon: LucideIcon;
  /** Display value - plain string or a CountUp node */
  value: React.ReactNode;
  label: string;
  delta?: string;
  trend?: "up" | "down";
  className?: string;
  tone?: "light" | "dark";
  /** When true (default), the card is wrapped in AnimatedSection.
   *  Set false when the parent handles stagger/reveal to avoid double animation. */
  animated?: boolean;
  /** CountUp-specific props - only used when value is a number and these are provided. */
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  delta,
  trend = "up",
  className,
  tone = "light",
  animated = true,
  prefix,
  suffix,
  decimals,
}: StatCardProps) {
  const content = (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-8 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1",
        tone === "light"
          ? "border border-border bg-white shadow-card hover:shadow-layered"
          : "border border-white/10 bg-white/[0.06] backdrop-blur-sm"
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)] shadow-soft",
          "transition-transform duration-300 group-hover:scale-110"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p
          className={cn(
            "text-3xl font-bold tracking-tight",
            tone === "light" ? "text-foreground" : "text-white"
          )}
        >
          {typeof value === "number" && (prefix || suffix || decimals !== undefined) ? (
            <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          ) : (
            value
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <p
            className={cn(
              "text-sm",
              tone === "light" ? "text-muted-foreground" : "text-white/60"
            )}
          >
            {label}
          </p>
          {delta && (
            <span
              className={cn(
                "font-mono text-[11px] font-semibold",
                trend === "up" ? "text-success" : "text-danger"
              )}
            >
              {trend === "up" ? "↑" : "↓"} {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!animated) return content;

  return <AnimatedSection y={20} className={cn("group", className)}>{content}</AnimatedSection>;
}