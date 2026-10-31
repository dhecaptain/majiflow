import Link from "next/link";
import { ArrowRight, Clock, MapPin, Star, Truck } from "lucide-react";
import type { Business } from "@/lib/types";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BlurImage } from "@/components/ui/blur-image";
import { Card } from "@/components/ui/card";
import { StationBadge } from "@/components/shared/station-badge";
import { BusinessAvailability } from "@/components/shared/business-availability";

interface BusinessCardProps {
  business: Business;
  className?: string;
  variant?: "default" | "catalog";
  distanceKm?: number;
  /** Rough minutes for a rider to reach the customer; falls back to the station average. */
  etaMinutes?: number;
  /** False when the station is close by but does not deliver to the customer yet. */
  delivers?: boolean;
}

function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) return "<1 km";
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function BusinessCard({
  business,
  className,
  variant = "default",
  distanceKm,
  etaMinutes,
  delivers = true,
}: BusinessCardProps) {
  const catalog = variant === "catalog";
  const eta = typeof etaMinutes === "number" && Number.isFinite(etaMinutes)
    ? etaMinutes
    : business.avgDeliveryMinutes;
  const hasRating = business.reviewCount > 0 && Number.isFinite(business.rating);
  return (
    <Link
      href={`/browse/${business.slug}`}
      className={cn(
        "group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        className
      )}
    >
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden border-border transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-layered group-active:translate-y-0 group-active:scale-[0.98]",
          catalog && "rounded-2xl shadow-soft"
        )}
      >
        {/* Cover */}
        <div className={cn("relative overflow-hidden bg-muted", catalog ? "aspect-[4/3]" : "aspect-[16/10]")}>
          <BlurImage
            src={business.cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

          <StationBadge
            verified={business.verified}
            paid={business.paid}
            className="absolute left-3 top-3"
          />

          {hasRating && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-foreground shadow-soft backdrop-blur">
              <Star className="size-3.5 fill-warning text-warning" aria-hidden />
              {business.rating}
              <span className="font-normal text-muted-foreground">({business.reviewCount})</span>
            </span>
          )}

          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-medium text-white">
            <MapPin className="size-3.5" aria-hidden /> {business.city}
          </span>
        </div>

        {/* Body */}
        <div className={cn("flex flex-1 flex-col", catalog ? "p-4" : "p-5")}>
          <h3 className={cn("line-clamp-1 font-display leading-snug text-foreground transition-colors group-hover:text-[var(--brand)]", catalog ? "text-xl" : "text-lg")}>
            {business.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {business.tagline}
          </p>

          <BusinessAvailability hours={business.openingHours} compact plain />
          {(typeof distanceKm === "number" || typeof eta === "number") && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--brand)]">
              {typeof distanceKm === "number" && Number.isFinite(distanceKm) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {formatDistanceKm(distanceKm)} away
                </span>
              )}
              {typeof eta === "number" && Number.isFinite(eta) && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  ~{Math.round(eta)} min
                </span>
              )}
            </p>
          )}

          {!delivers && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-semibold text-warning">
              Does not deliver here yet - collect in person
            </p>
          )}

          <div className="mt-auto border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Truck className="size-4 text-muted-foreground" aria-hidden />
                {formatKES(business.deliveryFee)} delivery
              </span>
              {business.freeDeliveryAbove > 0 && (
                <span className="text-xs text-success">Free over {formatKES(business.freeDeliveryAbove)}</span>
              )}
            </div>

            <span className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
              catalog
                ? "bg-brand text-white group-hover:bg-brand-deep group-hover:shadow-accent"
                : "bg-cta-soft text-[var(--brand)] group-hover:bg-[var(--brand)] group-hover:text-white group-hover:shadow-accent"
            )}>
              {catalog ? "Browse station" : "View menu"}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
