"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Gift, MapPin } from "lucide-react";
import { useStations } from "@/components/order/stations-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useSendWater } from "@/components/order/send-water-provider";
import { StationCard, StationCardSkeleton } from "@/components/shared/station-card";
import { discoverStations } from "@/lib/station-discovery";

const SHOWN = 4;

/**
 * The stations closest to the saved delivery point (or simply the open ones
 * first when no point is set yet), straight on the home page.
 */
export function NearbyStations() {
  const stations = useStations();
  const { address, hydrated } = useOrderSession();
  const { openLocation } = useOrderEntry();
  const located = typeof address?.lat === "number" && typeof address?.lng === "number";

  const rows = useMemo(() => {
    const { results } = discoverStations({
      stations,
      city: "All cities",
      location: located ? { lat: address!.lat!, lng: address!.lng! } : null,
      byDistance: located,
    });
    const reachable = located ? results.filter((row) => row.delivers) : results;
    const list = reachable.length > 0 ? reachable : results;
    // Open stations first; sort is stable, so distance order holds within each group.
    return [...list].sort((a, b) => Number(b.open) - Number(a.open)).slice(0, SHOWN);
  }, [stations, located, address]);

  const title = located ? "Stations near you" : "Stations on MajiFlow";

  return (
    <section aria-labelledby="near-title" className="mx-auto w-full max-w-[1200px] px-4 pt-8 sm:px-6 lg:pt-14">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="near-title" className="text-lg font-extrabold tracking-tight text-foreground lg:text-2xl">
          {title}
        </h2>
        {rows.length > 0 && (
          <Link href="/browse" className="text-sm font-semibold text-[var(--brand)] hover:underline lg:text-[15px]">
            See all
          </Link>
        )}
      </div>

      {!located && hydrated && rows.length > 0 && (
        <button
          type="button"
          onClick={openLocation}
          className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-[var(--brand)]/40 bg-brand-soft/60 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-brand-soft"
        >
          <MapPin className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
          <span className="flex-1">
            <span className="font-semibold">Set your location</span> to see who delivers to you and how long it takes.
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
        </button>
      )}

      {!hydrated ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5" role="status" aria-label="Loading stations">
          {Array.from({ length: SHOWN }, (_, i) => (
            <StationCardSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-xl bg-surface-2 p-6 text-center">
          <p className="text-base font-bold text-foreground">No stations are listed yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            New stations are joining. Check back soon, or tell us where you are from the stations page.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-[var(--brand)] px-5 text-sm font-bold text-white"
          >
            Go to stations
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {rows.map((row, index) => (
            <li key={row.business.id}>
              <StationCard
                business={row.business}
                distanceKm={row.distanceKm}
                etaMinutes={row.etaMinutes}
                priority={index === 0}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Send water to someone": opens the gift flow. */
export function SendWaterCard() {
  const { openSendWater } = useSendWater();
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pt-8 sm:px-6 lg:pt-12">
      <button
        type="button"
        onClick={openSendWater}
        className="flex w-full items-center gap-3.5 rounded-xl bg-coral-soft p-4 text-left text-foreground transition-colors hover:bg-[#ffe1d6] lg:p-5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-coral-cta text-white">
          <Gift className="size-[22px]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold lg:text-base">Send water to someone</span>
          <span className="text-[13px] text-muted-foreground lg:text-sm">
            Order for family or friends, delivered to their address.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-coral-cta-hover" aria-hidden />
      </button>
    </section>
  );
}
