"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Droplets,
  GlassWater,
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
  Package,
  Store,
  X,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Stagger, StaggerItem } from "@/components/ui/animated-section";
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
import { rememberJourneyStep } from "@/components/order/journey";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useSendWater } from "@/components/order/send-water-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { useToast } from "@/components/ui/toast";
import { useMotionSafe } from "@/lib/motion";
import { ButtonLoader } from "@/components/ui/button-loader";
import { BrowseSidebar, type BrowseJourneyStep, type BrowseSortMode } from "@/components/marketing/browse-sidebar";
import { BrowseStationCard, BrowseStationCardSkeleton } from "@/components/marketing/browse-station-card";
import { LocationModal } from "@/components/order/location-modal";
import { useBrowseContext } from "@/components/order/browse-context";
import { BrowseCartStep, BrowseLocationStep, BrowseOrderStep } from "@/components/marketing/browse-steps";

const StationMap = dynamic(() => import("@/components/ui/station-map").then((m) => m.StationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <ButtonLoader className="size-6 text-muted-foreground" />
    </div>
  ),
});

type LocationMode = "manual" | "current";

type WaterCategoryId = "refills" | "new-bottles" | "bottled-packs" | "dispensers";

const WATER_CATEGORIES: readonly {
  id: WaterCategoryId;
  label: string;
  detail: string;
  icon: typeof MapPin;
}[] = [
  { id: "refills", label: "Refill a can", detail: "Use your own container", icon: Droplets },
  { id: "new-bottles", label: "New bottle", detail: "Sealed and ready to go", icon: GlassWater },
  { id: "bottled-packs", label: "Bottle packs", detail: "Small bottles for home", icon: Package },
  { id: "dispensers", label: "Dispensers", detail: "Water close at hand", icon: Store },
];

function isWaterCategory(value: string): value is WaterCategoryId {
  return WATER_CATEGORIES.some((category) => category.id === value);
}

function stationOffersCategory(row: DiscoveredStation, category: WaterCategoryId): boolean {
  return row.business.products.some((product) => {
    if (category === "refills") return product.category === "refill";
    if (category === "dispensers") return product.category === "dispenser";
    if (product.category !== "bottled") return false;
    return category === "new-bottles"
      ? product.unit === "can"
      : product.unit !== "can";
  });
}

function etaOf(row: DiscoveredStation): number {
  return row.etaMinutes ?? row.business.avgDeliveryMinutes;
}

function offersFreeDelivery(row: DiscoveredStation): boolean {
  return row.business.deliveryFee === 0 || row.business.freeDeliveryAbove > 0;
}

export function BrowsePage({
  initialCity,
  initialQuery = "",
  initialCategory = "",
}: {
  initialCity: string;
  initialQuery?: string;
  initialCategory?: string;
}) {
  const session = useOrderSession();
  const {
    cart,
    selectStation: setSelectedStation,
    selectedStation: selectedBusiness,
    location: savedAddress,
    currentStep: journeyStep,
    orderChoice,
    setOrderChoice,
    setCurrentStep,
    canGoToStep,
  } = useBrowseContext();
  const { sendWater, openSendWater } = useSendWater();
  const { profile } = useCustomer();
  const { toast } = useToast();
  const { reduce } = useMotionSafe();
  const [city, setCity] = useState<string>(
    () => CITIES.find((c) => c.toLowerCase() === initialCity.trim().toLowerCase()) ?? "All cities"
  );
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<WaterCategoryId | null>(
    () => (isWaterCategory(initialCategory) ? initialCategory : null)
  );
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("manual");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<BrowseSortMode>("recommended");
  const [openOnly, setOpenOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [stepLocationOpen, setStepLocationOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const locationRequestRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const appliedSessionRef = useRef<string | null>(null);

  const sessionLat = savedAddress?.lat;
  const sessionLng = savedAddress?.lng;
  const sendLat = sendWater?.address.lat;
  const sendLng = sendWater?.address.lng;

  // The customer arrived from the order flow (or edited the address here), or
  // is sending water to someone else: adopt that point as the search center so
  // the list is already nearest-first, without another tap. The gift point wins.
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
    () =>
      discoverStations({
        city,
        query,
        location,
        byDistance: locationMode === "current",
      }),
    [city, location, locationMode, query]
  );

  // Presentation-only filter/reorder of the discovered list - discovery itself is untouched.
  const displayResults = useMemo(() => {
    let rows = discovery.results;
    if (sendWater) rows = rows.filter((r) => r.delivers);
    if (category) rows = rows.filter((row) => stationOffersCategory(row, category));
    if (openOnly) rows = rows.filter((r) => r.open);
    if (freeOnly) rows = rows.filter(offersFreeDelivery);
    const out = [...rows];
    if (sort === "rating") out.sort((a, b) => b.business.rating - a.business.rating);
    else if (sort === "fastest") out.sort((a, b) => etaOf(a) - etaOf(b));
    else if (sort === "distance") out.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    // Closed stations sink to the bottom. Array.sort is stable, so the order
    // chosen above (or the discovery distance order) is kept within each group.
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

  // Nothing here yet - ask to be notified when a station opens (reuses the
  // existing /api/stations/interest endpoint, no new logic).
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
      toast({
        kind: "success",
        title: "We'll let you know",
        message: "You'll hear from us when a station opens near you.",
      });
    } else {
      toast({ kind: "error", title: "That didn't save", message: result.error });
    }
  };

  const hasResults = displayResults.length > 0;
  const quickFiltersActive = sort !== "recommended" || openOnly || freeOnly;
  const currentStep: BrowseJourneyStep = journeyStep ?? "order";

  return (
    <div className="grid w-full grid-cols-1 items-start lg:grid-cols-[475px_minmax(0,1fr)]">
      <BrowseSidebar
        currentStep={currentStep}
        canGoToStep={canGoToStep}
        onSelectStep={setCurrentStep}
        sort={sort}
        onSortChange={setSort}
        openOnly={openOnly}
        onOpenOnlyChange={setOpenOnly}
        freeOnly={freeOnly}
        onFreeOnlyChange={setFreeOnly}
      />
      <main className="min-w-0">
      {currentStep === "order" && (
        <BrowseOrderStep
          choice={orderChoice}
          onChoice={setOrderChoice}
          onContinue={() => {
            setCurrentStep("location");
            if (!savedAddress) setStepLocationOpen(true);
          }}
        />
      )}
      {currentStep === "location" && (
        <BrowseLocationStep
          address={savedAddress}
          onOpenLocation={() => setStepLocationOpen(true)}
          onContinue={() => setCurrentStep("station")}
          canContinue={Boolean(savedAddress) && canGoToStep("station")}
        />
      )}
      {currentStep === "cart" && (
        <BrowseCartStep
          station={selectedBusiness}
          cart={cart}
          preferredSize={orderChoice.size}
          preferredQuantity={orderChoice.quantity}
          onChooseStation={() => setCurrentStep("station")}
        />
      )}
      {currentStep === "station" && (
      <>
      <section className="border-b border-border bg-surface-2 text-foreground">
        <Container className="py-5 sm:py-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Stations / Find nearby</p>
              <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                {currentStep === "station" ? "Stations" : "Choose a water station"}
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Compare nearby stations, delivery options, and opening hours.
              </p>
            </div>
            <div className="hidden min-w-48 rounded-xl border border-border bg-white px-4 py-3 shadow-soft md:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your location</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-35" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                </span>
                {location ? "Location selected" : "Choose a starting point"}
              </p>
            </div>
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="search-stations" className="sr-only">
              Search stations by name or estate
            </label>
            <Input
              id="search-stations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or estate - e.g. Kasarani"
              className="h-12 rounded-xl border-border bg-white pl-12 pr-12 text-base text-foreground shadow-soft"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter by city"
          >
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-all ${
                locationMode === "current"
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-white text-foreground/80 hover:border-brand/40 hover:text-foreground"
              }`}
            >
              {locating ? <ButtonLoader className="size-3.5" /> : <Navigation className="size-3.5" aria-hidden />}
              {locating ? "Finding…" : "Near me"}
            </button>
            {["All cities", ...CITIES].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectCity(c)}
                aria-pressed={city === c}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  city === c
                  ? "border-brand bg-brand text-white shadow-accent"
                  : "border-border bg-white text-foreground/80 hover:border-brand/40 hover:text-foreground"
                }`}
              >
                {c === "All cities" ? "Every city" : c}
              </button>
            ))}
          </div>

          {locationError ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-danger" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{locationError} Choose a city above to browse by an approximate location.</span>
            </p>
          ) : (
            !location && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tap “Near me” or a city to sort stations by distance.
              </p>
            )
          )}
        </Container>
      </section>

      <section
        className={`sticky z-30 border-b border-border bg-white/95 py-3 shadow-sm backdrop-blur sm:py-4 ${
          currentStep === "station"
            ? "top-[calc(178px+env(safe-area-inset-top))] md:top-[calc(204px+env(safe-area-inset-top))] lg:top-[calc(5.625rem+env(safe-area-inset-top))]"
            : "top-[calc(121px+env(safe-area-inset-top))] md:top-[calc(147px+env(safe-area-inset-top))] lg:top-[calc(5.625rem+env(safe-area-inset-top))]"
        }`}
      >
        <Container>
          <div className="flex items-center gap-4">
            <div className="hidden shrink-0 sm:block">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shop by</p>
              <p className="text-sm font-semibold text-foreground">Water type</p>
            </div>
            <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Station categories">
              <button
                type="button"
                onClick={() => setCategory(null)}
                aria-pressed={category === null}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-left transition-colors ${category === null ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground hover:border-brand/40"}`}
              >
                <Navigation className="size-3.5" aria-hidden />
                <span className="text-xs font-semibold">All stations</span>
              </button>
            {WATER_CATEGORIES.map((item) => {
              const active = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory((current) => current === item.id ? null : item.id)}
                  aria-pressed={active}
                  className={`group inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                    active ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground hover:border-brand/40 hover:bg-surface-2"
                  }`}
                >
                  <item.icon className="size-3.5" aria-hidden />
                  <span className="text-xs font-semibold">{item.label}</span>
                </button>
              );
            })}
            </nav>
          </div>
        </Container>
      </section>

      <section className="py-6 lg:py-8">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">{displayResults.length}</strong>{" "}
              {sendWater ? `stations delivering to ${sendWater.recipient.name}` : countLabel}
              {hasResults && quickFiltersActive && (
                <button
                  type="button"
                  onClick={clearQuickFilters}
                  className="ml-2 inline-flex min-h-8 items-center gap-1 rounded-full bg-cta-soft px-2.5 text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand)] hover:text-white"
                >
                  <X className="size-3" aria-hidden /> Clear
                </button>
              )}
            </p>
          </div>

          {(query.trim() || city !== "All cities" || locationMode === "current") && (
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Active filters">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Filters
              </span>
              {query.trim() && (
                <FilterChip label={query.trim()} onClear={() => setQuery("")} clearLabel="Clear search filter" />
              )}
              {city !== "All cities" && (
                <FilterChip label={city} onClear={() => selectCity("All cities")} clearLabel={`Stop filtering by ${city}`} />
              )}
              {!sendWater && locationMode === "current" && (
                <FilterChip label="Nearest to me" onClear={stopUsingCurrentLocation} clearLabel="Stop using my current location" />
              )}
            </div>
          )}

          {!session.hydrated && view === "list" ? (
            <div
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-5"
              aria-label="Loading nearby stations"
              role="status"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <BrowseStationCardSkeleton key={index} />
              ))}
            </div>
          ) : hasResults ? (
            <div className="mt-5">
              {/* List */}
              {view === "list" && (
                <div ref={listRef} className={locating ? "opacity-70" : undefined}>
                  {locating && (
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cta-soft px-3.5 py-2 text-sm font-medium text-[var(--brand)]">
                      <ButtonLoader className="size-4" />
                      Updating distances…
                    </div>
                  )}
                  <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-5" stagger={0.06}>
                    {displayResults.map((station) => (
                      <StaggerItem key={station.business.id}>
                        <div
                          data-station-id={station.business.id}
                          onMouseEnter={() => setSelectedId(station.business.id)}
                          onFocus={() => setSelectedId(station.business.id)}
                          onPointerDown={() => setSelectedId(station.business.id)}
                          className={`h-full rounded-lg transition-shadow ${
                            selectedId === station.business.id
                              ? "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-background"
                              : ""
                          }`}
                        >
                          <BrowseStationCard
                            station={station}
                            onSelect={() => {
                              setSelectedStation(station.business.id);
                              setCurrentStep("cart");
                            }}
                          />
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>

                  {/* Floating Map pill: the map is a full-screen layer, never a side panel. */}
                  <button
                    type="button"
                    onClick={() => setView("map")}
                    className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-accent transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <MapIcon className="size-4" aria-hidden /> Map
                  </button>
                </div>
              )}

              {/* Full-screen map, in sync with the list above it. */}
              {view === "map" && (
                <div className="fixed inset-0 z-[70] bg-white" aria-label="Stations on the map">
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
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-foreground shadow-layered transition-transform hover:scale-[1.02]"
                    >
                      <X className="size-4" aria-hidden /> Back to list
                    </button>
                    <span className="inline-flex min-h-11 items-center rounded-full bg-white/95 px-4 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur">
                      {displayResults.length} {countLabel}
                      {locationMode === "current" && discovery.radiusKm !== null
                        ? ` · within ${discovery.radiusKm} km${discovery.radiusKm > DISCOVERY_RADII_KM[0] ? ", expanded" : ""}`
                        : ""}
                    </span>
                  </div>

                  {/* Pin tap → mini card → open station. Shares selectedId with the list. */}
                  <AnimatePresence>
                    {selectedStation && (
                      <motion.div
                        key={selectedStation.business.id}
                        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
                        transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0.2 }}
                        className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[600] mx-auto max-w-lg"
                      >
                        <div className="relative overflow-hidden rounded-2xl bg-white shadow-layered">
                          <div className="flex items-center gap-3 p-3">
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                selectedStation.open ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                              }`}
                            >
                              {selectedStation.open ? "Open" : "Closed"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{selectedStation.business.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {selectedStation.distanceKm !== undefined && (
                                  <>{selectedStation.distanceKm < 1 ? "<1 km" : `${selectedStation.distanceKm.toFixed(1)} km`} · </>
                                )}
                                ~{Math.round(etaOf(selectedStation))} min · {formatFee(selectedStation.business)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStation(selectedStation.business.id);
                                setCurrentStep("cart");
                                setView("list");
                              }}
                              className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
                            >
                              View products
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedId(null)}
                              aria-label="Close station card"
                              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <X className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : discovery.results.length > 0 ? (
            <div className="mt-8">
              <EmptyState
                title={
                  sendWater
                    ? `No station delivers to ${sendWater.recipient.name} yet`
                    : "No stations match these filters"
                }
                description={
                  sendWater
                    ? "Try nudging the destination pin closer to a station - or ask us to notify you when one reaches this area."
                    : "Loosen the quick filters to see the stations around you again."
                }
                action={
                  sendWater ? (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <Button variant="secondary" onClick={openSendWater}>
                        Edit destination
                      </Button>
                      <Button variant="outline" onClick={notifyHere} disabled={notifying}>
                        {notifying ? (
                          <ButtonLoader className="size-4" />
                        ) : (
                          <Bell className="size-4" aria-hidden />
                        )}
                        Notify me when a station opens here
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" className="mt-2" onClick={clearQuickFilters}>
                      Clear quick filters
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={locationMode === "current" ? "No stations deliver here yet" : "No stations matched"}
                description={
                  locationMode === "current"
                    ? `No stations were found within ${DISCOVERY_RADII_KM[DISCOVERY_RADII_KM.length - 1]} km of your address. Try manual city selection or clear your search - or ask us to notify you when a station opens near you.`
                    : query
                      ? `No refill business matched "${query}"${city === "All cities" ? "" : ` in ${city}`}. Try a different name or estate.`
                      : `No stations are listed in ${city} yet. Try another city, browse everything, or ask us to notify you when one opens here.`
                }
                action={
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    <Button variant="secondary" onClick={resetFilters}>
                      Reset all filters
                    </Button>
                    {city !== "All cities" && (
                      <Button variant="outline" onClick={() => selectCity("All cities")}>
                        Browse every city
                      </Button>
                    )}
                    <Button variant="outline" onClick={notifyHere} disabled={notifying}>
                      {notifying ? (
                        <ButtonLoader className="size-4" />
                      ) : (
                        <Bell className="size-4" aria-hidden />
                      )}
                      Notify me when a station opens here
                    </Button>
                  </div>
                }
              />
            </div>
          )}
        </Container>
      </section>
      </>
      )}
      </main>
      <LocationModal
        open={stepLocationOpen}
        onClose={() => setStepLocationOpen(false)}
        onConfirm={() => {
          setStepLocationOpen(false);
          if (orderChoice.category && orderChoice.size) setCurrentStep("station");
        }}
      />
    </div>
  );
}

function formatFee(business: { deliveryFee: number; freeDeliveryAbove: number }): string {
  return business.deliveryFee === 0 ? "Free delivery" : `${formatKES(business.deliveryFee)} delivery`;
}

/** Removable summary of one active filter, shown above the results. */
function FilterChip({ label, onClear, clearLabel }: { label: string; onClear: () => void; clearLabel: string }) {
  return (
    <span className="inline-flex h-9 max-w-56 items-center gap-1 rounded-full border border-[var(--brand)]/25 bg-cta-soft pl-3 pr-1 text-sm font-medium text-[var(--brand)]">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
