import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  verified: boolean;
  /** Approved + active subscription renders the dark mark; approved-only renders grey. */
  paid?: boolean;
  className?: string;
}

/**
 * Platform trust mark.
 * - approved + paid  → dark "Verified" mark
 * - approved, unpaid → grey "Approved" mark
 * - not approved     → nothing
 */
export function VerifiedBadge({ verified, paid, className }: VerifiedBadgeProps) {
  if (!verified) return null;
  const isPaid = Boolean(paid);

  return (
    <span
      title={isPaid ? "Verified — subscription active" : "Approved — awaiting subscription payment"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        isPaid
          ? "border-transparent bg-ink text-white shadow-soft"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {isPaid ? "Verified" : "Approved"}
    </span>
  );
}
