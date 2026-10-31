import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

/** A card variant with layered shadow + white surface for elevated moments (hero cards, featured cards). */
export function ElevatedCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-layered",
        className
      )}
      {...props}
    />
  );
}

/** Gradient-border wrapper used on featured pricing / highlighted cards. Paints a 1px gradient ring. */
export function GradientBorderCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-brand-gradient p-px shadow-layered", className)}>
      <div className="flex h-full flex-col rounded-[calc(1rem-1px)] bg-white" {...props} />
    </div>
  );
}