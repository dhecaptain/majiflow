"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  LocateFixed,
  MapPin,
  Search,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  captureLocationBestEffort,
  geolocationErrorMessage,
  formatDistance,
  haversineMeters,
  nearestPlace,
  resolveCity,
  reverseGeocode,
  type CapturedLocation,
  type GeocodedAddress,
} from "@/lib/geo";
import { discoverStations } from "@/lib/station-discovery";
import { NearbySheet, NearbyStationList } from "@/components/order/nearby-sheet";
import type { DeliveryAddress, FulfillmentMethod } from "@/lib/types";
import { useCustomer } from "@/components/order/customer-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useCart } from "@/components/order/cart-provider";
import { useMotionSafe } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ButtonLoader } from "@/components/ui/button-loader";
import { MIN_PLACE_QUERY, PLACE_SEARCH_DEBOUNCE_MS, searchPlaces } from "@/lib/places";
import { requestStationInterest } from "@/lib/station-interest-client";
import type { PlaceResult } from "@/lib/place-types";
import { useStations } from "@/components/order/stations-provider";

const CenterPinMap = dynamic(
  () => import("@/components/ui/center-pin-map").then((m) => m.CenterPinMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-2">
        <ButtonLoader className="size-6 text-muted-foreground" />
      </div>
    ),
  }
);

export interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when a fulfilment choice / address is committed. */
  onConfirm?: () => void;
}

interface Point {
  lat: number;
  lng: number;
}

function oneLine(a: DeliveryAddress | null | undefined): string {
  if (!a) return "";
  return [a.street, a.estate, a.city].filter(Boolean).join(", ") || a.estate || a.label || "";
}

/**
 * The one place a customer chooses how to receive their water and where it
 * goes.
 *
 * The pin is authoritative - it is the coordinate the rider is given - while
 * the area/estate stays free text, because Kenyan estates are not always in
 * the map data. On a phone the map sits above a scrollable sheet; on a wide
 * screen the controls move to a column beside a full-height map.
 */
export function LocationModal({ open, onClose, onConfirm }: LocationModalProps) {
  const stations = useStations();
  const { profile } = useCustomer();
  const session = useOrderSession();
  const { items } = useCart();
  const { toast } = useToast();
  const { reduce, transition } = useMotionSafe();

  const [fulfilment, setFulfilment] = useState<FulfillmentMethod>(session.fulfilment);
  const [point, setPoint] = useState<Point | null>(null);
  const [focusTarget, setFocusTarget] = useState<(Point & { nonce: number }) | null>(null);
  const [geo, setGeo] = useState<GeocodedAddress | null>(null);
  const [estate, setEstate] = useState("");
  const [estateTouched, setEstateTouched] = useState(false);
  const [landmark, setLandmark] = useState("");
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<{ query: string; results: PlaceResult[] }>({
    query: "",
    results: [],
  });
  const [locating, setLocating] = useState(false);
  /** The customer's own GPS fix ("you are here"), separate from the pin they place. */
  const [userLoc, setUserLoc] = useState<CapturedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFulfilment, setPendingFulfilment] = useState<FulfillmentMethod | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const searchSeq = useRef(0);

  // Reset to the session's state each time the sheet opens. Adjusting state
  // during render (React's documented pattern) avoids an extra commit.
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFulfilment(session.fulfilment);
      setPoint(
        session.address?.lat && session.address?.lng
          ? { lat: session.address.lat, lng: session.address.lng }
          : null
      );
      setFocusTarget(null);
      setEstate(session.address?.estate ?? "");
      setEstateTouched(Boolean(session.address?.estate));
      setLandmark(session.address?.landmark ?? "");
      setQuery("");
      setSearchState({ query: "", results: [] });
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Debounced place search: one request per pause in typing, not per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_PLACE_QUERY) return;
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const places = await searchPlaces(trimmed, { lat: point?.lat, lng: point?.lng });
        if (seq !== searchSeq.current) return;
        setSearchState({ query: trimmed, results: places });
      } catch {
        if (seq !== searchSeq.current) return;
        setSearchState({ query: trimmed, results: [] });
      }
    }, PLACE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the bias point is only a hint; re-searching on every pan would be noise
  }, [query, open]);

  const savedAddresses = useMemo(
    () => profile.addresses.filter((a) => a.estate?.trim()),
    [profile.addresses]
  );

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= MIN_PLACE_QUERY;
  // Results only count once they belong to the query the customer is looking at.
  const results = hasQuery && searchState.query === trimmedQuery ? searchState.results : [];
  const searching = hasQuery && searchState.query !== trimmedQuery;

  const nearby = useMemo(() => {
    if (!point) return [];
    return discoverStations({ stations, city: "All cities", location: point, byDistance: true })
      .results.slice(0, 8)
      // Stations that can take orders right now come first; closed ones sink.
      .sort((a, b) => Number(b.open) - Number(a.open));
  }, [point, stations]);

  const applyGeo = useCallback(
    (address: GeocodedAddress | null, nextPoint: Point) => {
      setGeo(address);
      const near = nearestPlace(nextPoint.lat, nextPoint.lng);
      const nextEstate = address?.estate || near.estate || "";
      setEstate((current) => {
        // The customer's own words win over the map's guess.
        if (estateTouched && current.trim()) return current;
        return nextEstate || current;
      });
    },
    [estateTouched]
  );

  const movePin = useCallback((next: Point) => {
    setPoint(next);
    setFocusTarget({ ...next, nonce: Date.now() });
  }, []);

  const locateCustomer = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLocating(true);
    if (!silent) setError(null);
    try {
      const loc: CapturedLocation = await captureLocationBestEffort();
      if (!loc.approx) setUserLoc(loc);
      movePin({ lat: loc.lat, lng: loc.lng });
      const address = await reverseGeocode(loc.lat, loc.lng, loc.accuracy);
      applyGeo(address, { lat: loc.lat, lng: loc.lng });
    } catch (err) {
      // An automatic attempt on open stays quiet; the customer can still search or tap "locate".
      if (!silent) setError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  // Like a ride-hailing app: with no saved spot, start from where the customer is.
  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      autoLocatedRef.current = false;
      return;
    }
    if (autoLocatedRef.current || session.address?.lat) return;
    autoLocatedRef.current = true;
    void locateCustomer({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per opening
  }, [open]);

  const pickerStations = useMemo(
    () =>
      nearby.map((s) => ({
        id: s.business.id,
        name: s.business.name,
        lat: s.business.lat,
        lng: s.business.lng,
        open: s.open,
      })),
    [nearby]
  );

  // The bubble over the pin: where it is, how far from the customer, and the nearest station.
  const pinLabel = useMemo(() => {
    if (!point) return null;
    const title = geo?.street || geo?.estate || geo?.area || estate.trim() || "Dropped pin";
    const parts: string[] = [];
    if (userLoc) {
      const m = haversineMeters(userLoc, point);
      parts.push(m < 30 ? "You are here" : `${formatDistance(m)} from you`);
    }
    const nearest = nearby.find((s) => s.distanceKm !== undefined);
    if (nearest?.distanceKm !== undefined) {
      parts.push(
        `Nearest station ${formatDistance(nearest.distanceKm * 1000)}${nearest.etaMinutes ? ` · ~${nearest.etaMinutes} min` : ""}`
      );
    }
    return { title, detail: parts.join(" · ") || undefined };
  }, [point, geo, estate, userLoc, nearby]);

  const choosePlace = (place: PlaceResult) => {
    movePin({ lat: place.lat, lng: place.lng });
    setEstate(place.label);
    setEstateTouched(true);
    setQuery("");
    setSearchState({ query: "", results: [] });
    const near = nearestPlace(place.lat, place.lng);
    void reverseGeocode(place.lat, place.lng).then((address) => {
      setGeo(address);
      if (!near.city && address?.city) setGeo(address);
    });
  };

  const chooseSaved = (a: DeliveryAddress) => {
    if (typeof a.lat === "number" && typeof a.lng === "number") {
      movePin({ lat: a.lat, lng: a.lng });
    }
    setEstate(a.estate ?? "");
    setEstateTouched(true);
    setLandmark(a.landmark ?? "");
    session.setAddress(a);
    session.setFulfilment(fulfilment);
    toast({ kind: "success", title: "Delivery address set", message: oneLine(a) });
    onConfirm?.();
    onClose();
  };

  const changeFulfilment = (next: FulfillmentMethod) => {
    if (next === fulfilment) return;
    // An order already in the cart was built for one way of receiving it.
    if (items.length > 0) {
      setPendingFulfilment(next);
      return;
    }
    setFulfilment(next);
  };

  const confirmFulfilmentChange = () => {
    if (!pendingFulfilment) return;
    setFulfilment(pendingFulfilment);
    setPendingFulfilment(null);
  };

  const confirmPoint = () => {
    if (fulfilment === "delivery" && !point) {
      setError("Drop the pin on the map or pick a place first.");
      return;
    }
    const near = point ? nearestPlace(point.lat, point.lng) : { estate: undefined, city: undefined };
    const city = resolveCity(geo?.city, near.city) ?? undefined;
    const area = estate.trim() || geo?.estate || near.estate || "";
    const address: DeliveryAddress = {
      label: "Home",
      estate: area || city || "Pinned location",
      street: geo?.street,
      building: geo?.building,
      city,
      landmark: landmark.trim() || undefined,
      phone: profile.phone,
      lat: point?.lat,
      lng: point?.lng,
    };
    session.setAddress(address);
    session.setFulfilment(fulfilment);
    toast({
      kind: "success",
      title: fulfilment === "pickup" ? "Pickup selected" : "Location confirmed",
      message:
        fulfilment === "pickup" ? "Choose a station to collect from." : oneLine(address),
    });
    onConfirm?.();
    onClose();
  };

  const notifyWhenAvailable = async (businessId?: string) => {
    const result = await requestStationInterest({
      area: estate.trim() || geo?.estate || null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      businessId: businessId ?? null,
      phone: profile.phone || null,
    });
    if (result.ok) {
      toast({
        kind: "success",
        title: "We'll let you know",
        message: "We've noted this area and will alert you when a station is open.",
      });
      return;
    }
    toast({ kind: "error", title: "We could not save that", message: result.error });
  };

  const overlayTransition = reduce ? { duration: 0 } : { duration: 0.2 };
  const panelTransition = reduce
    ? { duration: 0 }
    : (transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] });

  const closeButton =
    "flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-foreground shadow-[0_2px_8px_rgba(11,37,69,0.12)] transition-colors hover:bg-surface-2";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-stretch justify-center lg:items-center lg:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Choose delivery or pickup and your location"
              className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white lg:grid lg:h-[88vh] lg:max-w-6xl lg:grid-cols-[440px_1fr] lg:rounded-2xl"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
              transition={panelTransition}
            >
              {/* Controls: a sheet over the map on a phone, a column beside it on a wide screen. */}
              <div className="relative z-10 order-2 -mt-6 flex min-h-0 flex-1 flex-col rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(11,37,69,0.12)] lg:order-1 lg:mt-0 lg:rounded-none lg:border-r lg:border-border lg:shadow-none">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col gap-4 px-4 pb-5 pt-2.5 sm:px-5 lg:pt-6">
                    <span aria-hidden className="h-1 w-10 self-center rounded-full bg-border lg:hidden" />
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                          {fulfilment === "pickup" ? "Where are you?" : "Where should we deliver?"}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Drop your pin, then tell us the area so the rider finds you
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3 lg:flex"
                      >
                        <X className="size-5" aria-hidden />
                      </button>
                    </div>

                    <FulfilmentToggle value={fulfilment} onChange={changeFulfilment} />

                    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-[var(--brand)]">
                        <MapPin className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5" aria-live="polite">
                        <span className="truncate text-[15px] font-bold text-foreground">
                          {pinLabel?.title ?? "No spot chosen yet"}
                        </span>
                        <span className="text-[13px] leading-snug text-muted-foreground">
                          {pinLabel
                            ? (pinLabel.detail ?? "Move the map so the pin sits on your door.")
                            : "Search, or move the map so the pin sits on your door."}
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void locateCustomer()}
                      disabled={locating}
                      className="flex min-h-11 items-center gap-3 self-start rounded-full pr-3 text-left text-sm font-bold text-[var(--brand)] transition-colors hover:underline disabled:opacity-80"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white shadow-soft">
                        {locating ? (
                          <ButtonLoader className="size-5" />
                        ) : (
                          <LocateFixed className="size-5" aria-hidden />
                        )}
                      </span>
                      {locating ? "Getting your location…" : "Use my current location"}
                    </button>

                    {error && (
                      <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                      </p>
                    )}

                    {savedAddresses.length > 0 && (
                      <div>
                        <p className="text-[13px] font-semibold text-muted-foreground">Saved</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {savedAddresses.map((a, i) => (
                            <button
                              key={`${a.estate}-${i}`}
                              type="button"
                              onClick={() => chooseSaved(a)}
                              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-[var(--brand)]/50"
                            >
                              <MapPin className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                              <span className="truncate">{a.label || a.estate}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <Field label="Area / estate" hint="Type it the way you say it">
                        <Input
                          value={estate}
                          onChange={(e) => {
                            setEstate(e.target.value);
                            setEstateTouched(true);
                          }}
                          placeholder="e.g. Kawangware"
                          className="h-12 rounded-md text-[15px] shadow-none"
                        />
                      </Field>
                      <Field label="Landmark / house no." hint="Helps the rider find you">
                        <Input
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Gate next to Naivas"
                          className="h-12 rounded-md text-[15px] shadow-none"
                        />
                      </Field>
                    </div>

                    {nearby.length > 0 && (
                      <div className="hidden sm:block lg:hidden">
                        <NearbyStationList stations={nearby} onNotify={notifyWhenAvailable} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#eef3fa] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3.5 sm:px-5">
                  <Button size="lg" className="h-[54px] w-full rounded-lg text-base font-bold hover:translate-y-0" onClick={confirmPoint}>
                    {fulfilment === "pickup" ? "Continue to stations" : "Confirm location"}
                  </Button>
                </div>
              </div>

              {/* The map: above the sheet on a phone, beside the controls on a wide screen. */}
              <div
                ref={mapAreaRef}
                className="relative z-0 order-1 h-[46svh] min-h-[260px] shrink-0 lg:order-2 lg:h-full"
              >
                <CenterPinMap
                  center={point}
                  focus={focusTarget}
                  onChange={(p) => setPoint(p)}
                  onAddress={applyGeo}
                  userLocation={userLoc}
                  onLocate={() => void locateCustomer()}
                  locating={locating}
                  stations={pickerStations}
                  label={pinLabel}
                  // The phone sheet overlaps the map's bottom edge; lift the locate button clear of it.
                  className="h-full w-full [&>button]:bottom-10 [&>button]:size-12 lg:[&>button]:bottom-5 lg:[&>button]:right-5"
                />

                {/* Search floats over the map, ride-hailing style. */}
                <div className="absolute inset-x-0 top-0 z-[600] flex items-start gap-2.5 p-3.5 sm:p-4">
                  <button type="button" onClick={onClose} aria-label="Close" className={cn(closeButton, "lg:hidden")}>
                    <X className="size-5" aria-hidden />
                  </button>
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-6 size-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <label htmlFor="loc-search" className="sr-only">
                      Search for an estate, area or town
                    </label>
                    <Input
                      id="loc-search"
                      ref={firstFieldRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search estate, area or town"
                      className="h-12 rounded-md border-0 bg-white pl-11 text-[15px] shadow-[0_2px_8px_rgba(11,37,69,0.12)]"
                      autoComplete="off"
                    />

                    {hasQuery && (
                      <ul className="absolute inset-x-0 top-full mt-2 max-h-[max(9rem,calc(46svh-7.5rem))] lg:max-h-80 divide-y divide-border overflow-y-auto rounded-md bg-white shadow-float">
                        {searching && results.length === 0 && (
                          <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
                        )}
                        {!searching && results.length === 0 && (
                          <li className="px-4 py-3 text-sm text-muted-foreground">
                            No match. Try another spelling, or drop a pin on the map.
                          </li>
                        )}
                        {results.map((place) => (
                          <li key={place.id}>
                            <button
                              type="button"
                              onClick={() => choosePlace(place)}
                              className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                            >
                              <MapPin
                                className="mt-0.5 size-4 shrink-0 text-[var(--brand)]"
                                aria-hidden
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {place.label}
                                </span>
                                {place.sublabel && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {place.sublabel}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {nearby.length > 0 && (
                  // Stops short of the sheet's rounded overlap so the peek stays visible.
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 top-0 sm:hidden [&>*]:pointer-events-auto">
                    <NearbySheet
                      stations={nearby}
                      onNotify={notifyWhenAvailable}
                      containerRef={mapAreaRef}
                    />
                  </div>
                )}
              </div>

              <ConfirmSwitch
                open={pendingFulfilment !== null}
                next={pendingFulfilment}
                current={fulfilment}
                onConfirm={confirmFulfilmentChange}
                onCancel={() => setPendingFulfilment(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The location sheet owns its own stacking context, so this confirmation is
 * drawn inside it rather than through the shared dialog (which would sit
 * underneath the sheet).
 */
function ConfirmSwitch({
  open,
  next,
  current,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  next: FulfillmentMethod | null;
  current: FulfillmentMethod;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { reduce } = useMotionSafe();
  if (!open || !next) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-20 flex items-end justify-center p-4 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      >
        <div className="absolute inset-0 bg-ink/50" onClick={onCancel} aria-hidden />
        <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="switch-fulfilment-title"
          className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-layered"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 id="switch-fulfilment-title" className="text-lg font-extrabold tracking-tight text-foreground">
            Switch to {next === "pickup" ? "pickup" : "delivery"}?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your cart already has items. Switching changes the fees and what the station does next.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <Button size="lg" className="flex-1 rounded-lg font-bold" onClick={onConfirm}>
              Switch to {next === "pickup" ? "pickup" : "delivery"}
            </Button>
            <Button size="lg" variant="secondary" className="flex-1 rounded-lg font-bold shadow-none" onClick={onCancel}>
              Keep {current === "pickup" ? "pickup" : "delivery"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FulfilmentToggle({
  value,
  onChange,
}: {
  value: FulfillmentMethod;
  onChange: (next: FulfillmentMethod) => void;
}) {
  const options: { id: FulfillmentMethod; label: string; icon: React.ReactNode }[] = [
    { id: "delivery", label: "Deliver", icon: <Truck className="size-4" aria-hidden /> },
    { id: "pickup", label: "Pick up", icon: <Store className="size-4" aria-hidden /> },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="How would you like to receive your order?"
      className="grid grid-cols-2 gap-1 rounded-lg bg-surface-3 p-1"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors",
              active
                ? "bg-white text-[var(--brand)] shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
