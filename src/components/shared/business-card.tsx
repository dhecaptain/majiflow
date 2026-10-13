import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, Truck } from "lucide-react";
import type { Business } from "@/lib/types";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StationBadge } from "@/components/shared/station-badge";
import { BusinessAvailability } from "@/components/shared/business-availability";

interface BusinessCardProps {
  business: Business;
  className?: string;
  distanceKm?: number;
}

function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) return "<1 km";
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function BusinessCard({
  business,
  className,
  distanceKm,
}: BusinessCardProps) {
  return (
    <Link
      href={`/browse/${business.slug}`}
      className={cn(
        "group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0052FF]",
        className
      )}
    >
      <Card className="flex h-full flex-col overflow-hidden border-border transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-layered">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Image
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

          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-foreground shadow-soft backdrop-blur">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden />
            {business.rating}
          </span>

          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-medium text-white">
            <MapPin className="size-3.5" aria-hidden /> {business.city}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-1 font-display text-lg leading-snug text-foreground transition-colors group-hover:text-[#0052FF]">
            {business.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {business.tagline}
          </p>

          <BusinessAvailability hours={business.openingHours} compact plain />
          {typeof distanceKm === "number" && Number.isFinite(distanceKm) && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052FF]">
              <MapPin className="size-3.5" aria-hidden />{" "}
              {formatDistanceKm(distanceKm)} away
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

            <span className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors group-hover:border-[#0052FF]/40 group-hover:text-[#0052FF]">
              View menu
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
