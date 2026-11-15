"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Bell, ChevronDown, Gift, Map as MapIcon, MapPin, Navigation, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CITIES } from "@/lib/constants";
import {
  captureCurrentLocation,
  geolocationErrorMessage,
  townLocation,
  type CapturedLocation,
} from "@/lib/geo";
import { DISCOVERY_RADII_KM, discoverStations, type DiscoveredStation } from "@/lib/station-discovery";
import { formatKES } from "@/lib/format";
import { requestStationInterest } from "@/lib/station-interest-client";
import { browseHref } from "@/lib/journey";
import { cn } from "@/lib/utils";
import { rememberJourneyStep } from "@/components/order/journey";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useSendWater } from "@/components/order/send-water-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { useToast } from "@/components/ui/toast";
import { useMotionSafe } from "@/lib/motion";
import { ButtonLoader } from "@/components/ui/button-loader";
import { StationCard, StationCardSkeleton } from "@/components/shared/station-card";
import { useStations } from "@/components/order/stations-provider";
import { addressLabel } from "@/components/layout/site-header";
import {
  WATER_CATEGORY_IDS,
  WATER_CATEGORY_LABELS,
  isWaterCategory,
  offersCategory,
  type WaterCategoryId,
} from "@/lib/categories";

const StationMap = dynamic(() => import("@/components/ui/station-map").then((m) => m.StationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <ButtonLoader className="size-6 text-muted-foreground" />
    </div>
  ),
});

type LocationMode = "manual" | "current";
type SortMode = "recommended" | "distance" | "fastest" | "rating";

const SORT_LABELS: Record<SortMode, string> = {
  recommended: "Recommended",
  distance: "Nearest",
  fastest: "Fastest delivery",
  rating: "Top rated",
};

const CATEGORY_IMAGES: Record<WaterCategoryId, string> = {
  refills: "/categories/refills.jpg",
  "new-bottles": "/categories/new-bottles.jpg",
  "bottled-packs": "/categories/bottled-packs.jpg",
  dispensers: "/categories/dispensers.jpg",
};

function etaOf(row: DiscoveredStation): number {
  return row.etaMinutes ?? row.business.avgDeliveryMinutes;
}

function offersFreeDelivery(row: DiscoveredStation): boolean {
  return row.business.deliveryFee === 0 || row.business.freeDeliveryAbove > 0;
}

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]";
const chipOn = "border-foreground bg-foreground text-white";
const chipOff = "border-border bg-white text-foreground hover:border-[var(--brand)]/40";

/**
 * The station list: search, water type, quick filters and city, then every
 * matching station as a card. Choosing a card opens that station's menu.
 */
export function BrowsePage({
  initialCity,
  initialQuery = "",
  initialCategory = "",
}: {
  initialCity: string;
  initialQuery?: string;
  initialCategory?: string;
}) {
  const stations = useStations();
  const session = useOrderSession();
  const savedAddress = session.address;
  const { openLocation } = useOrderEntry();
  const { sendWater, openSendWater } = useSendWater();
  const { profile } = useCustomer();
  const { toast } = useToast();
  const { reduce } = useMotionSafe();
  const [city, setCity] = useState<string>(
    () => CITIES.find((c) => c.toLowerCase() === initialCity.trim().toLowerCase()) ?? "All cities"
  );
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<WaterCategoryId | null>(() =>
    isWaterCategory(initialCategory) ? initialCategory : null
  );
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("manual");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [openOnly, setOpenOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const locationRequestRef = useRef(0);
  const appliedSessionRef = useRef<string | null>(null);

  const sessionLat = savedAddress?.lat;
  const sessionLng = savedAddress?.lng;
  const sendLat = sendWater?.address.lat;
  const sendLng = sendWater?.address.lng;

  // The customer set a delivery point (or is sending water to someone else):
  // adopt it as the search center so the list is already nearest-first. The gift point wins.
  useEffect(() => {
    const usingSend = typeof sendLat === "number" && typeof sendLng === "number";
    const lat = usingSend ? sendLat : sessionLat;
    const lng = usingSend ? sendLng : sessionLng;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const signature = `${usingSend ? "sw" : "ss"}:${lat},${lng}`;
    if (appliedSessionRef.current === signature) return;
    appliedSessionRef.current = signature;
    locationRequestRef.current += 1;
    setLocation({ lat, lng, at: new Date().toISOString() });
    setLocationMode("current");
    setLocationError(null);
    setLocating(false);
  }, [sendLat, sendLng, sessionLat, sessionLng]);

  // Keep the search in the URL so back navigation from a station restores it.
  useEffect(() => {
    const baseHref = browseHref(city, query);
    const href = category
      ? `${baseHref}${baseHref.includes("?") ? "&" : "?"}category=${encodeURIComponent(category)}`
      : baseHref;
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, "", href);
    }
    rememberJourneyStep("browse", href);
  }, [city, query, category]);

  // The map is a full-screen layer - keep the page behind it from scrolling.
  useEffect(() => {
    if (view !== "map") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView("list");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [view]);

  const discovery = useMemo(
    () => discoverStations({ stations, city, query, location, byDistance: locationMode === "current" }),
    [city, location, locationMode, query, stations]
  );

  // Presentation-only filter/reorder of the discovered list - discovery itself is untouched.
  const displayResults = useMemo(() => {
    let rows = discovery.results;
    if (sendWater) rows = rows.filter((r) => r.delivers);
    if (category) rows = rows.filter((row) => offersCategory(row.business, category));
    if (openOnly) rows = rows.filter((r) => r.open);
    if (freeOnly) rows = rows.filter(offersFreeDelivery);
    const out = [...rows];
    if (sort === "rating") out.sort((a, b) => b.business.rating - a.business.rating);
    else if (sort === "fastest") out.sort((a, b) => etaOf(a) - etaOf(b));
    else if (sort === "distance") out.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    // Closed stations sink to the bottom; the sort is stable, so the order above holds within each group.
    return out.sort((a, b) => Number(b.open) - Number(a.open));
  }, [discovery.results, sort, openOnly, freeOnly, sendWater, category]);

  // The map shows exactly what the list shows, and shares the selected station.
  const mapStations = useMemo(
    () =>
      displayResults
        .filter(({ business }) => Number.isFinite(business.lat) && Number.isFinite(business.lng))
        .map(({ business, distanceKm }) => ({
          id: business.id,
          slug: business.slug,
          name: business.name,
          city: business.city,
          lat: business.lat,
          lng: business.lng,
          deliveryFee: business.deliveryFee,
          distanceKm,
        })),
    [displayResults]
  );

  const mapUserLocation = useMemo(
    () =>
      location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
        ? { lat: location.lat, lng: location.lng }
        : null,
    [location]
  );

  const selectedStation = useMemo(
    () => displayResults.find((r) => r.business.id === selectedId) ?? null,
    [displayResults, selectedId]
  );

  const countLabel =
    locationMode === "current" ? "nearby" : city === "All cities" ? "in all cities" : `in ${city}`;

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
      const nextLocation = await captureCurrentLocation({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
      if (requestId !== locationRequestRef.current) return;
      setLocation(nextLocation);
      setLocationMode("current");
    } catch (err) {
      if (requestId !== locationRequestRef.current) return;
      setLocationMode("manual");
      setLocation(city === "All cities" ? null : townLocation(city));
      setLocationError(geolocationErrorMessage(err));
    } finally {
      if (requestId === locationRequestRef.current) setLocating(false);
    }
  };

  const stopUsingCurrentLocation = () => {
    locationRequestRef.current += 1;
    setLocationMode("manual");
    setLocation(city === "All cities" ? null : townLocation(city));
    setLocationError(null);
    setLocating(false);
  };

  const clearQuickFilters = () => {
    setSort("recommended");
    setOpenOnly(false);
    setFreeOnly(false);
  };

  const resetFilters = () => {
    locationRequestRef.current += 1;
    setQuery("");
    setCity("All cities");
    setLocationMode("manual");
    setLocation(null);
    setLocationError(null);
    setLocating(false);
    setCategory(null);
    clearQuickFilters();
  };

  // Nothing here yet - ask to be notified when a station opens (the existing interest endpoint).
  const notifyHere = async () => {
    setNotifying(true);
    const result = await requestStationInterest({
      area: city === "All cities" ? null : city,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      businessId: null,
      phone: profile.phone || null,
    });
    setNotifying(false);
    if (result.ok) {
      toast({ kind: "success", title: "We'll let you know", message: "You'll hear from us when a station opens near you." });
    } else {
      toast({ kind: "error", title: "That didn't save", message: result.error });
    }
  };

  const hasResults = displayResults.length > 0;
  const quickFiltersActive = sort !== "recommended" || openOnly || freeOnly;
  const savedLabel = addressLabel(savedAddress);

  const notifyButton = (
    <Button variant="outline" onClick={notifyHere} disabled={notifying}>
      {notifying ? <ButtonLoader className="size-4" /> : <Bell className="size-4" aria-hidden />}
      Notify me when a station opens here
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-5 sm:px-6 lg:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold tracking-tight text-foreground lg:text-[32px]">Stations</h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          {sendWater
            ? `Stations that deliver to ${sendWater.recipient.name}.`
            : savedLabel
              ? `Delivering to ${savedLabel}.`
              : "Compare prices, delivery fees and opening hours."}
        </p>
      </div>

      {sendWater && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-coral-soft px-4 py-3 text-sm text-foreground">
          <Gift className="size-5 shrink-0 text-coral-cta" aria-hidden />
          <span className="flex-1">
            Sending water to <strong className="font-semibold">{sendWater.recipient.name}</strong>
          </span>
          <button type="button" onClick={openSendWater} className="min-h-11 font-semibold text-[var(--brand)] hover:underline">
            Edit
          </button>
        </div>
      )}

      {/* Search */}
      <label className="mt-4 flex h-12 items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-4 text-muted-foreground transition-colors focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--brand)]/15">
        <Search className="size-[18px] shrink-0" aria-hidden />
        <span className="sr-only">Search stations by name or estate</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or estate, e.g. Kasarani"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="-mr-2 flex size-10 items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      {/* Water type */}
      <nav aria-label="Water type" className="-mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {WATER_CATEGORY_IDS.map((id) => {
          const active = category === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCategory((current) => (current === id ? null : id))}
              aria-pressed={active}
              className={cn(
                "flex h-12 shrink-0 items-center gap-2.5 rounded-lg border pl-1.5 pr-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                active ? "border-[var(--brand)] bg-brand-soft text-brand-deep" : "border-border bg-white text-foreground hover:border-[var(--brand)]/40"
              )}
            >
              <span className="relative size-9 overflow-hidden rounded-md bg-surface-3">
                <Image src={CATEGORY_IMAGES[id]} alt="" fill sizes="36px" className="object-cover" />
              </span>
              {WATER_CATEGORY_LABELS[id]}
            </button>
          );
        })}
      </nav>

      {/* Quick filters */}
      <div role="group" aria-label="Filters" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={locationMode === "current" && !sendWater ? stopUsingCurrentLocation : useCurrentLocation}
          disabled={locating}
          aria-pressed={locationMode === "current"}
          className={cn(chip, locationMode === "current" ? chipOn : chipOff)}
        >
          {locating ? <ButtonLoader className="size-3.5" /> : <Navigation className="size-3.5" aria-hidden />}
          {locating ? "Finding you…" : "Near me"}
        </button>
        <button type="button" onClick={() => setOpenOnly((v) => !v)} aria-pressed={openOnly} className={cn(chip, openOnly ? chipOn : chipOff)}>
          Open now
        </button>
        <button type="button" onClick={() => setFreeOnly((v) => !v)} aria-pressed={freeOnly} className={cn(chip, freeOnly ? chipOn : chipOff)}>
          Free delivery
        </button>
        <label className={cn(chip, "relative pr-8", sort !== "recommended" ? chipOn : chipOff)}>
          <span className="sr-only">Sort stations</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="absolute inset-0 cursor-pointer appearance-none rounded-full bg-transparent pl-3.5 pr-8 text-transparent outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode} className="text-foreground">
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
          <span aria-hidden>{SORT_LABELS[sort]}</span>
          <ChevronDown className="pointer-events-none absolute right-3 size-3.5" aria-hidden />
        </label>
        <button
          type="button"
          onClick={() => setShowCities((v) => !v)}
          aria-expanded={showCities}
          className={cn(chip, city !== "All cities" ? chipOn : chipOff)}
        >
          <MapPin className="size-3.5" aria-hidden />
          {city === "All cities" ? "City" : city}
          <ChevronDown className={cn("size-3.5 transition-transform", showCities && "rotate-180")} aria-hidden />
        </button>
      </div>

      {showCities && (
        <div role="group" aria-label="Filter by city" className="mt-2 flex flex-wrap gap-2 rounded-lg bg-surface-2 p-3">
          {["All cities", ...CITIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                selectCity(c);
                setShowCities(false);
              }}
              aria-pressed={city === c}
              className={cn(chip, city === c ? "border-[var(--brand)] bg-[var(--brand)] text-white" : chipOff)}
            >
              {c === "All cities" ? "Every city" : c}
            </button>
          ))}
        </div>
      )}

      {locationError && (
        <p className="mt-3 flex items-start gap-2 text-sm text-danger" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {locationError}{" "}
            <button type="button" onClick={openLocation} className="font-semibold underline">
              Set your location on the map
            </button>{" "}
            instead.
          </span>
        </p>
      )}

      {/* Results */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <strong className="font-bold text-foreground">{displayResults.length}</strong>{" "}
          {displayResults.length === 1 ? "station" : "stations"} {countLabel}
        </p>
        {hasResults && quickFiltersActive && (
          <button type="button" onClick={clearQuickFilters} className="min-h-11 text-sm font-semibold text-[var(--brand)] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {!session.hydrated ? (
        <div className="mt-4 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" role="status" aria-label="Loading stations">
          {Array.from({ length: 6 }, (_, index) => (
            <StationCardSkeleton key={index} />
          ))}
        </div>
      ) : hasResults ? (
        <>
          <ul className={cn("mt-4 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6", locating && "opacity-70")}>
            {displayResults.map((row, index) => (
              <li key={row.business.id}>
                <StationCard
                  business={row.business}
                  distanceKm={row.distanceKm}
                  etaMinutes={row.etaMinutes}
                  priority={index < 2}
                  onSelect={() => session.setStationId(row.business.id)}
                />
              </li>
            ))}
          </ul>

          {/* The map is a full-screen layer, opened from a floating pill. */}
          <button
            type="button"
            onClick={() => setView("map")}
            className="fixed bottom-[calc(var(--tabbar-h)+1rem)] left-1/2 z-40 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-white shadow-float transition-transform hover:scale-[1.03] active:scale-[0.98] lg:bottom-8"
          >
            <MapIcon className="size-4" aria-hidden /> Map
          </button>
        </>
      ) : discovery.results.length > 0 ? (
        <EmptyState
          className="mt-8"
          title={sendWater ? `No station delivers to ${sendWater.recipient.name} yet` : "No stations match these filters"}
          description={
            sendWater
              ? "Try moving the destination pin closer to a station, or ask us to tell you when one reaches this area."
              : "Loosen the filters to see the stations around you again."
          }
          action={
            sendWater ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={openSendWater}>
                  Edit destination
                </Button>
                {notifyButton}
              </div>
            ) : (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  clearQuickFilters();
                  setCategory(null);
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <EmptyState
          className="mt-8"
          title={locationMode === "current" ? "No stations deliver here yet" : "No stations matched"}
          description={
            locationMode === "current"
              ? `No stations were found within ${DISCOVERY_RADII_KM[DISCOVERY_RADII_KM.length - 1]} km of your location. Try another city, or ask us to tell you when a station opens near you.`
              : query
                ? `No station matched "${query}"${city === "All cities" ? "" : ` in ${city}`}. Try a different name or estate.`
                : `No stations are listed in ${city} yet. Try another city, or ask us to tell you when one opens here.`
          }
          action={
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" onClick={resetFilters}>
                Reset all filters
              </Button>
              {notifyButton}
            </div>
          }
        />
      )}

      {/* Full-screen map, in sync with the list. */}
      {view === "map" && (
        <div className="fixed inset-0 z-[70] bg-white" role="dialog" aria-modal="true" aria-label="Stations on the map">
          <StationMap
            stations={mapStations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            userLocation={mapUserLocation}
            frameless
            className="h-full w-full"
          />
          <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[600] flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView("list")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-foreground shadow-layered"
            >
              <X className="size-4" aria-hidden /> List
            </button>
            <span className="inline-flex h-11 items-center rounded-full bg-white/95 px-4 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur">
              {displayResults.length} {displayResults.length === 1 ? "station" : "stations"} {countLabel}
              {locationMode === "current" && discovery.radiusKm !== null
                ? ` · within ${discovery.radiusKm} km${discovery.radiusKm > DISCOVERY_RADII_KM[0] ? ", expanded" : ""}`
                : ""}
            </span>
          </div>

          <AnimatePresence>
            {selectedStation && (
              <motion.div
                key={selectedStation.business.id}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0.2 }}
                className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[600] mx-auto max-w-md"
              >
                <div className="relative rounded-xl bg-white p-3 shadow-layered">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close station card"
                    className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white text-foreground shadow-soft"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                  <StationCard
                    business={selectedStation.business}
                    distanceKm={selectedStation.distanceKm}
                    etaMinutes={selectedStation.etaMinutes}
                    onSelect={() => session.setStationId(selectedStation.business.id)}
                  />
                  <p className="mt-2 px-0.5 text-xs text-muted-foreground">
                    {selectedStation.business.deliveryFee === 0
                      ? "Free delivery"
                      : `${formatKES(selectedStation.business.deliveryFee)} delivery`}{" "}
                    · ~{Math.round(etaOf(selectedStation))} min
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
