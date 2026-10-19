"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Navigation, Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { BusinessCard } from "@/components/shared/business-card";
import { EmptyState } from "@/components/ui/feedback";
import { Stagger, StaggerItem } from "@/components/ui/animated-section";
import { businesses, getBusinessesByCity } from "@/lib/data/businesses";
import { CITIES } from "@/lib/constants";
import {
  captureCurrentLocation,
  geolocationErrorMessage,
  haversineMeters,
  townLocation,
  type CapturedLocation,
} from "@/lib/geo";
import { browseHref } from "@/lib/journey";
import { rememberJourneyStep } from "@/components/order/journey";

const DISCOVERY_RADII_KM = [3, 5, 10, 20] as const;

type LocationMode = "manual" | "current";

export function BrowsePage({ initialCity, initialQuery = "" }: { initialCity: string; initialQuery?: string }) {
  const [city, setCity] = useState<string>(
    () => CITIES.find((c) => c.toLowerCase() === initialCity.trim().toLowerCase()) ?? "All cities"
  );
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("manual");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationRequestRef = useRef(0);

  // Keep the search in the URL so back navigation from a station restores it.
  useEffect(() => {
    const href = browseHref(city, query);
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, "", href);
    }
    rememberJourneyStep("browse", href);
  }, [city, query]);

  const discovery = useMemo(() => {
    const source = locationMode === "current" ? businesses : getBusinessesByCity(city);
    const q = query.trim().toLowerCase();
    const searched = !q
      ? source
      : source.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.city.toLowerCase().includes(q) ||
            b.estates.some((e) => e.toLowerCase().includes(q)) ||
            b.tagline.toLowerCase().includes(q)
        );

    if (locationMode !== "current" || !location) {
      return {
        results: searched
          .map((business, index) => {
            const hasValidLocation =
              location !== null &&
              Number.isFinite(location.lat) &&
              Number.isFinite(location.lng) &&
              Number.isFinite(business.lat) &&
              Number.isFinite(business.lng);
            const distanceKm = hasValidLocation
              ? haversineMeters(location, business) / 1000
              : undefined;
            return { business, distanceKm, index };
          })
          .sort((a, b) => {
            if (a.distanceKm === undefined && b.distanceKm === undefined) {
              return a.index - b.index;
            }
            if (a.distanceKm === undefined) return 1;
            if (b.distanceKm === undefined) return -1;
            return a.distanceKm - b.distanceKm;
          }),
        radiusKm: null,
      };
    }

    const radiusKm =
      DISCOVERY_RADII_KM.find((radius) =>
        searched.some(
          (business) =>
            Number.isFinite(business.lat) &&
            Number.isFinite(business.lng) &&
            haversineMeters(location, business) / 1000 <= radius
        )
      ) ?? DISCOVERY_RADII_KM[DISCOVERY_RADII_KM.length - 1];

    return {
      results: searched
        .map((business, index) => {
          if (!Number.isFinite(business.lat) || !Number.isFinite(business.lng)) {
            return null;
          }
          const distanceKm = haversineMeters(location, business) / 1000;
          return distanceKm <= radiusKm ? { business, distanceKm, index } : null;
        })
        .filter(
          (
            result
          ): result is {
            business: (typeof businesses)[number];
            distanceKm: number;
            index: number;
          } => result !== null
        )
        .sort((a, b) => a.distanceKm - b.distanceKm),
      radiusKm,
    };
  }, [city, location, locationMode, query]);

  const countLabel =
    locationMode === "current"
      ? "nearby stations"
      : city === "All cities"
        ? "all stations"
        : `stations in ${city}`;

  const selectCity = (nextCity: string) => {
    locationRequestRef.current += 1;
    setCity(nextCity);
    setLocationMode("manual");
    setLocation(nextCity === "All cities" ? null : townLocation(nextCity));
    setLocationError(null);
    setLocating(false);
  };

  const useCurrentLocation = async () => {
    const requestId = ++locationRequestRef.current;
    setLocating(true);
    setLocationError(null);
    try {
      const nextLocation = await captureCurrentLocation({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 0,
      });
      if (requestId !== locationRequestRef.current) return;
      setLocation(nextLocation);
      setLocationMode("current");
    } catch (err) {
      if (requestId !== locationRequestRef.current) return;
      setLocationMode("manual");
      setLocation(city === "All cities" ? null : townLocation(city));
      setLocationError(geolocationErrorMessage(err));
    } finally {
      if (requestId === locationRequestRef.current) {
        setLocating(false);
      }
    }
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <Container className="relative py-14 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-foreground animate-ping-slow" />
                <span className="relative inline-flex size-2 rounded-full bg-foreground" />
              </span>
              Browse refill stations
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              Refill stations <span className="text-gradient">near you</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Search and filter stations by name, estate or city. Each one lists its own products,
              prices and delivery fee before you order.
            </p>
            <div className="relative mt-8">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="search-stations" className="sr-only">
                Search stations by name or estate
              </label>
              <Input
                id="search-stations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or estate - e.g. Kasarani"
                className="h-14 rounded-xl pl-12 text-base shadow-card"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter by city">
              {["All cities", ...CITIES].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectCity(c)}
                  aria-pressed={city === c}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    city === c
                      ? "border-[#0052FF] bg-[#0052FF] text-white shadow-accent"
                      : "border-border bg-white text-muted-foreground hover:border-[#0052FF]/40 hover:text-[#0052FF]"
                  }`}
                >
                  {c === "All cities" ? "Every city" : c}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={useCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Navigation className="size-4" aria-hidden />
                )}
                {locating ? "Finding stations near you…" : "Use my current location"}
              </Button>
              {locationError && (
                <p className="flex items-start gap-2 text-left text-xs text-danger" role="alert">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {locationError} Choose a city above to browse by an approximate location.
                  </span>
                </p>
              )}
              {!location && !locationError && (
                <p className="text-xs text-muted-foreground">
                  Choose a city or allow location access to sort stations by distance.
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-14 lg:py-20">
        <Container>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">{discovery.results.length}</strong>{" "}
              {countLabel}
            </p>
          </div>

          {discovery.results.length > 0 ? (
            <div
              className="relative"
              aria-busy={locating}
              aria-label={locating ? "Updating station distances" : undefined}
            >
              <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
              {discovery.results.map(({ business, distanceKm }) => (
                <StaggerItem key={business.id}>
                  <BusinessCard business={business} distanceKm={distanceKm} />
                </StaggerItem>
              ))}
              </Stagger>
              {locating && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Updating distances…
                </div>
              )}
              {locationMode === "current" && discovery.radiusKm !== null && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing stations within {discovery.radiusKm} km
                  {discovery.radiusKm > DISCOVERY_RADII_KM[0] ? " after expanding the search" : ""}.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={locationMode === "current" ? "No nearby stations found" : "No stations matched"}
                description={
                  locationMode === "current"
                    ? `No stations were found within ${DISCOVERY_RADII_KM[DISCOVERY_RADII_KM.length - 1]} km of your location. Try manual city selection or clear your search.`
                    : `No refill business matched "${query}" in ${city}. Try a different estate or clear your search.`
                }
                action={
                  <button
                    onClick={() => setQuery("")}
                    className="mt-2 font-semibold text-[#0052FF] hover:underline"
                  >
                    Clear search
                  </button>
                }
              />
            </div>
          )}
        </Container>
      </section>
    </>
  );
}