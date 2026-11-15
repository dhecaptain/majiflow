"use client";

import Link from "next/link";
import { Clock, ShieldCheck, Star } from "lucide-react";
import type { Business } from "@/lib/types";
import { listPrice } from "@/lib/cart";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BlurImage } from "@/components/ui/blur-image";
import { SkeletonBlock } from "@/components/ui/skeleton-card";
import { useBusinessAvailability } from "@/components/shared/business-availability";

function distanceLabel(distanceKm: number): string {
  if (distanceKm < 1) return "<1 km";
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

/** Cheapest visible price on the menu, used as "Refills from KSh X". */
function startingPrice(business: Business): { amount: number; refills: boolean } | null {
  const visible = business.products.filter((p) => !p.hidden);
  const refills = visible.filter((p) => p.category === "refill");
  const pool = refills.length > 0 ? refills : visible;
  if (pool.length === 0) return null;
  const amount = Math.min(...pool.map((p) => listPrice(p).amount));
  return { amount, refills: refills.length > 0 };
}

const AVAILABILITY_PILL = {
  open: { label: "Open now", dot: "bg-success" },
  closed: { label: "Closed now", dot: "bg-danger" },
  unknown: { label: "Hours not confirmed", dot: "bg-warning" },
} as const;

/**
 * A station in a list: cover photo with open state and delivery time, then
 * name, rating and the facts a customer compares on (area, fee, price).
 */
export function StationCard({
  business,
  distanceKm,
  etaMinutes,
  onSelect,
  className,
  priority = false,
}: {
  business: Business;
  distanceKm?: number;
  etaMinutes?: number;
  onSelect?: () => void;
  className?: string;
  priority?: boolean;
}) {
  const availability = useBusinessAvailability(business.openingHours);
  const pill = AVAILABILITY_PILL[availability.state];
  const hasRating = business.reviewCount > 0 && Number.isFinite(business.rating);
  const minutes = Math.round(etaMinutes ?? business.avgDeliveryMinutes);
  const price = startingPrice(business);
  const area = business.estates[0] ?? business.city;

  const meta = [
    distanceKm !== undefined && Number.isFinite(distanceKm) ? `${area} · ${distanceLabel(distanceKm)}` : area,
    business.deliveryFee === 0 ? "Free delivery" : `${formatKES(business.deliveryFee)} delivery`,
    price ? `${price.refills ? "Refills from" : "From"} ${formatKES(price.amount)}` : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/browse/${business.slug}`}
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-3 rounded-xl text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]",
        className
      )}
    >
      <span className="relative block aspect-[16/9] overflow-hidden rounded-xl bg-surface-3">
        <BlurImage
          src={business.cover}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            availability.state === "closed" && "grayscale-[60%]"
          )}
        />
        <span className="absolute left-2.5 top-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-bold text-foreground shadow-soft">
          <span className={cn("size-[7px] rounded-full", pill.dot)} aria-hidden />
          {pill.label}
        </span>
        <span className="absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-full bg-foreground px-2.5 text-xs font-bold text-white">
          <Clock className="size-3.5" aria-hidden />
          {minutes} min
        </span>
      </span>

      <span className="flex flex-col gap-1 px-0.5">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-base font-bold">{business.name}</span>
            {business.verified && (
              <ShieldCheck className="size-4 shrink-0 text-aqua-deep" aria-label="Verified station" />
            )}
          </span>
          {hasRating ? (
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold">
              <Star className="size-3.5 fill-sun text-sun" aria-hidden />
              {business.rating.toFixed(1)}
              <span className="font-medium text-muted-foreground">({business.reviewCount})</span>
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-aqua-soft px-2 py-0.5 text-[11px] font-bold text-[#00707d]">New</span>
          )}
        </span>
        <span className="line-clamp-2 text-[13px] text-muted-foreground">{meta.join(" · ")}</span>
        {business.freeDeliveryAbove > 0 && business.deliveryFee > 0 && (
          <span className="text-[13px] font-semibold text-success">
            Free delivery over {formatKES(business.freeDeliveryAbove)}
          </span>
        )}
      </span>
    </Link>
  );
}

export function StationCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <SkeletonBlock className="aspect-[16/9] w-full rounded-xl" />
      <SkeletonBlock className="h-4 w-3/5" />
      <SkeletonBlock className="h-3 w-4/5" />
    </div>
  );
}
