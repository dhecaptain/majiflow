"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  MapPin,
  Navigation,
  Search,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CITIES, CITY_COORDS } from "@/lib/constants";
import {
  captureLocationBestEffort,
  geolocationErrorMessage,
  nearestPlace,
  resolveCity,
  reverseGeocode,
  type CapturedLocation,
  type GeocodedAddress,
} from "@/lib/geo";
import { discoverStations } from "@/lib/station-discovery";
import { PICKUP_ENABLED } from "@/config/fulfilment";
import { NearbySheet, NearbyStationList } from "@/components/order/nearby-sheet";
import type { DeliveryAddress, FulfillmentMethod } from "@/lib/types";
import { useCustomer } from "@/components/order/customer-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useMotionSafe } from "@/lib/motion";
import { ButtonLoader } from "@/components/ui/button-loader";

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

type Step = "type" | "search" | "map";

export interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when a fulfilment choice / address is committed. */
  onConfirm?: () => void;
}

function oneLine(a: DeliveryAddress | null | undefined): string {
  if (!a) return "";
  return [a.street, a.estate, a.city].filter(Boolean).join(", ") || a.estate || a.label || "";
}

export function LocationModal({ open, onClose, onConfirm }: LocationModalProps) {
  const { profile } = useCustomer();
  const session = useOrderSession();
  const { toast } = useToast();
  const { reduce, transition } = useMotionSafe();

  const [step, setStep] = useState<Step>("type");
  const [fulfilment, setFulfilment] = useState<FulfillmentMethod>(session.fulfilment);
  const [query, setQuery] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    session.address?.lat && session.address?.lng
      ? { lat: session.address.lat, lng: session.address.lng }
      : null
  );
  const [geo, setGeo] = useState<GeocodedAddress | null>(null);
  const [landmark, setLandmark] = useState(session.address?.landmark ?? "");
  const [district, setDistrict] = useState(session.address?.estate ?? "");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  // Reset to the first sensible step each time the modal opens. Adjusting
  // state during render (React's documented pattern) avoids an extra commit.
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFulfilment(session.fulfilment);
      setStep(session.fulfilment === "pickup" ? "search" : "type");
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 120);
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

  const savedAddresses = profile.addresses.filter((a) => a.estate?.trim());
  const filteredAddresses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedAddresses;
    return savedAddresses.filter((a) =>
      [a.label, a.estate, a.street, a.city, a.building].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [savedAddresses, query]);

  const nearby = useMemo(() => {
    if (!point) return [];
    return discoverStations({ city: "All cities", location: point, byDistance: true })
      .results.slice(0, 8)
      // Stations that can take orders right now come first; closed ones sink.
      .sort((a, b) => Number(b.open) - Number(a.open));
  }, [point]);

  const applyGeo = (address: GeocodedAddress | null, nextPoint: { lat: number; lng: number }) => {
    setGeo(address);
    const near = nearestPlace(nextPoint.lat, nextPoint.lng);
    const nextEstate = address?.estate || near.estate || "";
    if (nextEstate) setDistrict(nextEstate);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const loc: CapturedLocation = await captureLocationBestEffort();
      const nextPoint = { lat: loc.lat, lng: loc.lng };
      setPoint(nextPoint);
      const address = await reverseGeocode(loc.lat, loc.lng, loc.accuracy);
      applyGeo(address, nextPoint);
      setStep("map");
    } catch (err) {
      setError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const chooseSaved = (a: DeliveryAddress) => {
    if (typeof a.lat === "number" && typeof a.lng === "number") {
      setPoint({ lat: a.lat, lng: a.lng });
    }
    setDistrict(a.estate ?? "");
    setLandmark(a.landmark ?? "");
    session.setAddress(a);
    session.setFulfilment(fulfilment);
    toast({ kind: "success", title: "Delivery address set", message: oneLine(a) });
    onConfirm?.();
    onClose();
  };

  const chooseCity = (city: string) => {
    const coords = CITY_COORDS[city];
    if (coords) setPoint(coords);
    const a: DeliveryAddress = {
      label: "Home",
      estate: city,
      city,
      phone: profile.phone,
      lat: coords?.lat,
      lng: coords?.lng,
    };
    setDistrict(city);
    session.setAddress(a);
    session.setFulfilment(fulfilment);
    toast({ kind: "success", title: `${city} selected`, message: "Pin the exact spot on the map next." });
    setStep("map");
  };

  const confirmPoint = () => {
    if (!point) {
      setError("Move the map to place your pin first.");
      return;
    }
    const near = nearestPlace(point.lat, point.lng);
    const estate = district.trim() || geo?.estate || near.estate || "";
    const city = resolveCity(geo?.city, near.city) ?? undefined;
    const address: DeliveryAddress = {
      label: "Home",
      estate: estate || city || "Pinned location",
      street: geo?.street,
      building: geo?.building,
      city,
      landmark: landmark.trim() || undefined,
      phone: profile.phone,
      lat: point.lat,
      lng: point.lng,
    };
    session.setAddress(address);
    session.setFulfilment(fulfilment);
    toast({ kind: "success", title: "Location confirmed", message: oneLine(address) });
    onConfirm?.();
    onClose();
  };

  const confirmPickup = () => {
    session.setFulfilment("pickup");
    toast({ kind: "success", title: "Pickup selected", message: "Choose a station to collect from." });
    onConfirm?.();
    onClose();
  };

  const notifyWhenAvailable = () =>
    toast({
      kind: "success",
      title: "We'll let you know",
      message: "We've noted this area and will alert you when a station is open.",
    });

  const overlayTransition = reduce ? { duration: 0 } : { duration: 0.2 };
  const panelTransition = reduce ? { duration: 0 } : (transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-stretch justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
        >
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={PICKUP_ENABLED ? "Choose delivery or pickup and your location" : "Choose how to receive your order"}
            className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:rounded-3xl"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={panelTransition}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
              {step !== "type" && session.fulfilment !== "pickup" && (
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  aria-label="Back"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  <ArrowLeft className="size-5" aria-hidden />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg text-foreground">
                  {fulfilment === "pickup" ? "Pick up your water" : fulfilment === "delivery" && step === "type" ? "How would you like it?" : "Where should we go?"}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {step === "map"
                    ? "Move the map, then confirm"
                    : PICKUP_ENABLED
                      ? "Delivery or pickup - you can change this later"
                      : "A rider brings it to your door - you can change this later"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* STEP A - fulfilment */}
              {step === "type" && (
                <div className={`grid gap-3 p-5 ${PICKUP_ENABLED ? "sm:grid-cols-2" : ""}`}>
                  <TypeCard
                    selected={fulfilment === "delivery"}
                    onSelect={() => {
                      setFulfilment("delivery");
                      setStep("search");
                    }}
                    icon={<Truck className="size-6" aria-hidden />}
                    title="Delivery"
                    subtitle="A rider brings it to your door"
                    refProp={undefined}
                  />
                  {PICKUP_ENABLED && (
                    <TypeCard
                      selected={fulfilment === "pickup"}
                      onSelect={() => {
                        setFulfilment("pickup");
                        confirmPickup();
                      }}
                      icon={<Store className="size-6" aria-hidden />}
                      title="Pickup"
                      subtitle="Collect from a station - no delivery fee"
                      badge="Free"
                    />
                  )}
                </div>
              )}

              {/* STEP B - search */}
              {step === "search" && (
                <div className="p-5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <label htmlFor="loc-search" className="sr-only">
                      Search for an estate, area or town
                    </label>
                    <Input
                      id="loc-search"
                      ref={firstFieldRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search estate, area or town"
                      className="h-13 rounded-xl pl-12 text-base"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-[var(--brand)]/30 bg-cta-soft px-4 py-3 text-left text-sm font-semibold text-[var(--brand)] transition-colors hover:border-[var(--brand)]"
                  >
                    {locating ? <ButtonLoader className="size-5" /> : <Navigation className="size-5" aria-hidden />}
                    {locating ? "Getting your location…" : "Use my current location"}
                  </button>

                  {error && (
                    <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-danger">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                    </p>
                  )}

                  {filteredAddresses.length > 0 && (
                    <div className="mt-5">
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Recent</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {filteredAddresses.map((a, i) => (
                          <button
                            key={`${a.estate}-${i}`}
                            type="button"
                            onClick={() => chooseSaved(a)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--brand)]/50"
                          >
                            <MapPin className="size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
                            <span className="truncate">{a.label || a.estate}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {query.trim() && (
                    <div className="mt-5">
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Cities</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CITIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase())).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => chooseCity(c)}
                            className="rounded-full border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--brand)]/50"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep("map")}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-3 text-sm font-semibold text-foreground hover:border-[var(--brand)]/40"
                  >
                    <MapPin className="size-4 text-[var(--brand)]" aria-hidden /> Pin it on the map instead
                  </button>
                </div>
              )}

              {/* STEP C - map */}
              {step === "map" && (
                <div className="flex h-full flex-col">
                  <div
                    ref={mapAreaRef}
                    className="relative h-[46vh] min-h-[280px] shrink-0 sm:h-[360px]"
                  >
                    <CenterPinMap
                      center={point}
                      onChange={(p) => setPoint(p)}
                      onAddress={applyGeo}
                      className="h-full w-full"
                    />
                    {/* On phones the nearby list floats over the map as a
                        draggable sheet; wider screens get the inline list. */}
                    {nearby.length > 0 && (
                      <div className="sm:hidden">
                        <NearbySheet
                          stations={nearby}
                          onNotify={notifyWhenAvailable}
                          containerRef={mapAreaRef}
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cta-soft text-[var(--brand)]">
                        <MapPin className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {district || geo?.estate || "Your pinned location"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[geo?.street, geo?.building, resolveCity(geo?.city)].filter(Boolean).join(" · ") ||
                            "Drag the map to fine-tune the exact spot"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Area / estate">
                        <Input
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g. Kasarani"
                        />
                      </Field>
                      <Field label="Landmark / house no." hint="Helps the rider find you">
                        <Input
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Gate next to Naivas"
                        />
                      </Field>
                    </div>

                    {error && (
                      <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-danger">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                      </p>
                    )}

                    {nearby.length > 0 ? (
                      <div className="mt-5 hidden sm:block">
                        <NearbyStationList
                          stations={nearby}
                          onNotify={notifyWhenAvailable}
                        />
                      </div>
                    ) : (
                      <div className="mt-5 sm:hidden">
                        <NearbyStationList
                          stations={nearby}
                          onNotify={notifyWhenAvailable}
                        />
                      </div>
                    )}
                  </div>

                  {/* Sticky confirm */}
                  <div className="sticky bottom-0 shrink-0 border-t border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <Button size="lg" className="w-full" onClick={confirmPoint}>
                      <Check className="size-4" aria-hidden /> Confirm location
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TypeCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  badge,
  refProp,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  refProp?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={refProp}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[120px] flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all",
        selected
          ? "border-[var(--brand)] bg-cta-soft/60 ring-2 ring-[var(--brand)]/20"
          : "border-border bg-white hover:border-[var(--brand)]/40 hover:shadow-soft"
      )}
    >
      <span className={cn("flex size-12 items-center justify-center rounded-xl", selected ? "bg-[var(--brand)] text-white" : "bg-surface-3 text-muted-foreground")}>
        {icon}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-base font-semibold text-foreground">{title}</span>
        {badge && <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-success">{badge}</span>}
      </span>
      <span className="text-sm text-muted-foreground">{subtitle}</span>
    </button>
  );
}

