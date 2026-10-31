import { Star } from "lucide-react";
import type { DiscoveredStation } from "@/lib/station-discovery";
import { formatKES } from "@/lib/format";
import { BlurImage } from "@/components/ui/blur-image";
import { SkeletonBlock } from "@/components/ui/skeleton-card";
import { StationBadge } from "@/components/shared/station-badge";
import { BusinessAvailability } from "@/components/shared/business-availability";

function distanceLabel(distanceKm: number): string {
  if (distanceKm < 1) return "<1 km";
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function BrowseStationCard({
  station,
  onSelect,
}: {
  station: DiscoveredStation;
  onSelect: () => void;
}) {
  const { business, distanceKm, etaMinutes } = station;
  const hasRating = business.reviewCount > 0 && Number.isFinite(business.rating);
  const areas = business.estates.slice(0, 2).join(" · ") || business.city;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <BlurImage
          src={business.cover}
          alt=""
          fill
          sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover object-center"
        />
        <StationBadge
          verified={business.verified}
          paid={business.paid}
          className="absolute left-2 top-2 !gap-1 !px-2 !py-0.5 !text-[10px]"
        />
        {hasRating && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-foreground shadow-soft">
            <Star className="size-3 fill-warning text-warning" aria-hidden />
            {business.rating.toFixed(1)}
            <span className="font-normal text-muted-foreground">({business.reviewCount})</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center px-3 pb-3 pt-3 text-center">
        <h2 className="line-clamp-1 w-full text-sm font-bold leading-snug text-foreground sm:text-base">
          {business.name}
        </h2>
        <p className="mt-1 line-clamp-1 w-full text-xs leading-relaxed text-muted-foreground">
          {areas}
          {distanceKm !== undefined && Number.isFinite(distanceKm)
            ? ` · ${distanceLabel(distanceKm)}`
            : ""}
        </p>
        <BusinessAvailability
          hours={business.openingHours}
          compact
          plain
          className="mt-1 justify-center text-[11px]"
        />
        <p className="mt-2 text-xs font-semibold text-foreground">
          Delivery from {formatKES(business.deliveryFee)} · {Math.round(etaMinutes ?? business.avgDeliveryMinutes)} min
        </p>
        <button
          type="button"
          onClick={onSelect}
          className="mt-3 inline-flex min-h-8 items-center justify-center gap-1 rounded-full bg-brand px-3.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span aria-hidden>+</span> Select Station
        </button>
      </div>
    </article>
  );
}

export function BrowseStationCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white">
      <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col items-center gap-2.5 px-3 pb-3 pt-3">
        <SkeletonBlock className="h-4 w-3/5" />
        <SkeletonBlock className="h-3 w-4/5" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="mt-1 h-3 w-4/5" />
        <SkeletonBlock className="mt-1 h-8 w-28 rounded-full" />
      </div>
    </div>
  );
}
