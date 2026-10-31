import { cn } from "@/lib/utils";

/**
 * A single soft, brand-tinted block with a slow shimmer sweep. Pure CSS, so it
 * works in server components and never ships any JavaScript.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton-block", className)}>
      <span className="skeleton-sheen" />
    </div>
  );
}

export type SkeletonVariant =
  | "station"
  | "catalog-station"
  | "product"
  | "menu"
  | "promotion"
  | "metric"
  | "row"
  | "text";

interface SkeletonCardProps {
  /** Which real content shape to mirror. */
  variant?: SkeletonVariant;
  className?: string;
  /** Number of text lines, for the `text` variant. */
  lines?: number;
}

/**
 * Skeletons that match the real card layouts one for one, so nothing jumps
 * when the content arrives.
 */
export function SkeletonCard({ variant = "station", className, lines = 3 }: SkeletonCardProps) {
  if (variant === "product") {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
        <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <SkeletonBlock className="h-4 w-3/5" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-5 w-24" />
          <SkeletonBlock className="h-8 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === "catalog-station") {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
        <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
        <div className="flex flex-1 flex-col gap-3 p-4">
          <SkeletonBlock className="h-5 w-3/5" />
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-4/5" />
          <SkeletonBlock className="h-3 w-1/3" />
          <SkeletonBlock className="mt-1 h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === "menu") {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <SkeletonBlock className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-1/2" />
          <SkeletonBlock className="h-3 w-1/3" />
        </div>
        <SkeletonBlock className="h-4 w-16 shrink-0" />
      </div>
    );
  }

  if (variant === "promotion") {
    return (
      <div
        className={cn(
          "flex min-w-[15rem] flex-1 items-center gap-3 rounded-2xl border border-[var(--brand)]/15 bg-cta-soft/50 px-4 py-3",
          className
        )}
      >
        <SkeletonBlock className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="size-4 shrink-0 rounded" />
      </div>
    );
  }

  if (variant === "metric") {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="size-5 rounded-lg" />
        </div>
        <SkeletonBlock className="mt-3 h-7 w-20" />
        <SkeletonBlock className="mt-2 h-3 w-32" />
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-2xl border border-border bg-card p-4",
          className
        )}
      >
        <SkeletonBlock className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-1/2" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
        <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-2.5", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  }

  // station
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <SkeletonBlock className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <SkeletonBlock className="h-5 w-3/5" />
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-4/5" />
        <SkeletonBlock className="h-3 w-1/3" />
      </div>
    </div>
  );
}
