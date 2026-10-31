"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  MapPin,
  Navigation,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  captureLocationBestEffort,
  geolocationErrorMessage,
  nearestPlace,
  resolveCity,
  reverseGeocode,
  type CapturedLocation,
  type GeocodedAddress,
} from "@/lib/geo";
import { MIN_PLACE_QUERY, PLACE_SEARCH_DEBOUNCE_MS, searchPlaces } from "@/lib/places";
import type { PlaceResult } from "@/lib/place-types";
import type { DeliveryAddress } from "@/lib/types";
import { isKenyanMobile, normalizeKenyanPhone } from "@/lib/phone";
import { useMotionSafe } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ButtonLoader } from "@/components/ui/button-loader";
import type { SendWaterRecipient, SendWaterState } from "@/components/order/send-water-provider";

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

const MESSAGE_MAX_LENGTH = 200;

interface SendWaterModalProps {
  open: boolean;
  /** Existing destination/recipient to edit, if the gift was set before. */
  initial: SendWaterState | null;
  onClose: () => void;
  onConfirm: (next: SendWaterState) => void;
}

interface Point {
  lat: number;
  lng: number;
}

export function SendWaterModal({ open, initial, onClose, onConfirm }: SendWaterModalProps) {
  const { reduce, transition } = useMotionSafe();

  const [step, setStep] = useState<"place" | "recipient">("place");
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
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const searchSeq = useRef(0);

  // Reset to the stored gift each time the sheet opens (adjust-during-render
  // pattern, same as the location sheet).
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setStep("place");
      const iLat = initial?.address.lat;
      const iLng = initial?.address.lng;
      setPoint(typeof iLat === "number" && typeof iLng === "number" ? { lat: iLat, lng: iLng } : null);
      setFocusTarget(null);
      setGeo(null);
      setEstate(initial?.address.estate ?? "");
      setEstateTouched(Boolean(initial?.address.estate));
      setLandmark(initial?.address.landmark ?? "");
      setQuery("");
      setSearchState({ query: "", results: [] });
      setError(null);
      setName(initial?.recipient.name ?? "");
      setPhone(initial?.recipient.phone ?? "");
      setMessage(initial?.recipient.message ?? "");
      setPhoneError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const target = step === "place" ? firstFieldRef.current : nameFieldRef.current;
    const t = window.setTimeout(() => target?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [open, step]);

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

  // Debounced place search, biased toward the current pin.
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

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= MIN_PLACE_QUERY;
  const results = hasQuery && searchState.query === trimmedQuery ? searchState.results : [];
  const searching = hasQuery && searchState.query !== trimmedQuery;

  const applyGeo = useCallback(
    (address: GeocodedAddress | null, nextPoint: Point) => {
      setGeo(address);
      const near = nearestPlace(nextPoint.lat, nextPoint.lng);
      const nextEstate = address?.estate || near.estate || "";
      setEstate((current) => {
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

  const useCurrentLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const loc: CapturedLocation = await captureLocationBestEffort();
      movePin({ lat: loc.lat, lng: loc.lng });
      const address = await reverseGeocode(loc.lat, loc.lng, loc.accuracy);
      applyGeo(address, { lat: loc.lat, lng: loc.lng });
    } catch (err) {
      setError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const choosePlace = (place: PlaceResult) => {
    movePin({ lat: place.lat, lng: place.lng });
    setEstate(place.label);
    setEstateTouched(true);
    setQuery("");
    setSearchState({ query: "", results: [] });
    void reverseGeocode(place.lat, place.lng).then((address) => setGeo(address));
  };

  const goToRecipient = () => {
    if (!point) {
      setError("Drop the pin on the map or pick a place first.");
      return;
    }
    setError(null);
    setStep("recipient");
  };

  const confirmSend = () => {
    if (!point) {
      setError("Drop the pin on the map or pick a place first.");
      setStep("place");
      return;
    }
    if (!name.trim()) {
      setError("Tell us who this water is for.");
      return;
    }
    setError(null);
    const local = normalizeKenyanPhone(phone);
    if (!local || !isKenyanMobile(local)) {
      setPhoneError("Enter a Kenyan mobile number, e.g. 0712 345 678.");
      return;
    }
    const near = nearestPlace(point.lat, point.lng);
    const city = resolveCity(geo?.city, near.city) ?? undefined;
    const area = estate.trim() || geo?.estate || near.estate || "";
    const address: DeliveryAddress = {
      label: "Gift",
      estate: area || city || "Pinned location",
      street: geo?.street,
      building: geo?.building,
      city,
      landmark: landmark.trim() || undefined,
      phone: local,
      lat: point.lat,
      lng: point.lng,
    };
    const recipient: SendWaterRecipient = {
      name: name.trim(),
      phone: local,
      message: message.trim(),
    };
    onConfirm({ recipient, address });
  };

  const overlayTransition = reduce ? { duration: 0 } : { duration: 0.2 };
  const panelTransition = reduce
    ? { duration: 0 }
    : (transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] });

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Send water to someone"
            className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white lg:h-[88vh] lg:max-w-5xl lg:rounded-3xl"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={panelTransition}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {step === "place" ? "Step 1 of 2 - Destination" : "Step 2 of 2 - Recipient"}
                </p>
                <h2 className="font-display text-lg text-foreground">
                  Where should we send the water?
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            {step === "place" ? (
              <div className="grid min-h-0 flex-1 grid-rows-[minmax(200px,34vh)_1fr] lg:grid-cols-[400px_1fr] lg:grid-rows-1">
                <div className="order-2 flex min-h-0 flex-col overflow-y-auto overscroll-contain lg:order-1 lg:border-r lg:border-border">
                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <label htmlFor="send-search" className="sr-only">
                        Search the area you want to send water to
                      </label>
                      <Input
                        id="send-search"
                        ref={firstFieldRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search estate, area or town"
                        className="h-13 rounded-xl pl-12 text-base"
                        autoComplete="off"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--brand)]/30 bg-cta-soft px-4 py-3 text-left text-sm font-semibold text-[var(--brand)] transition-colors hover:border-[var(--brand)]"
                    >
                      {locating ? (
                        <ButtonLoader className="size-5" />
                      ) : (
                        <Navigation className="size-5" aria-hidden />
                      )}
                      {locating ? "Getting your location…" : "Use my current location"}
                    </button>

                    {error && (
                      <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                      </p>
                    )}

                    {hasQuery && (
                      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
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
                              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                            >
                              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
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

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <Field label="Area / estate" hint="Where they would say they live">
                        <Input
                          value={estate}
                          onChange={(e) => {
                            setEstate(e.target.value);
                            setEstateTouched(true);
                          }}
                          placeholder="e.g. Kawangware"
                        />
                      </Field>
                      <Field label="Landmark / house no." hint="Helps the rider find the door">
                        <Input
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Blue gate near the shop"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="sticky bottom-0 shrink-0 border-t border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <Button size="lg" className="w-full" onClick={goToRecipient}>
                      <UserRound className="size-4" aria-hidden />
                      Next: who is it for?
                    </Button>
                  </div>
                </div>

                <div className="relative order-1 min-h-[200px] lg:order-2 lg:h-full">
                  <CenterPinMap
                    center={point}
                    focus={focusTarget}
                    onChange={(p) => setPoint(p)}
                    onAddress={applyGeo}
                    className="h-full w-full"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6 sm:py-8">
                    {error && (
                      <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                      </p>
                    )}

                    <div className="rounded-2xl border border-border bg-surface-2 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Delivering to
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {[estate.trim(), geo?.city].filter(Boolean).join(", ") || "Pinned location"}
                      </p>
                      {landmark.trim() && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{landmark.trim()}</p>
                      )}
                    </div>

                    <Field label="Recipient's name" hint="Who is this water for?" required>
                      <Input
                        ref={nameFieldRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Achieng' Owino"
                        autoComplete="off"
                      />
                    </Field>

                    <Field
                      label="Recipient's phone"
                      required
                      hint="The rider calls this number"
                      error={phoneError ?? undefined}
                    >
                      <Input
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (phoneError) setPhoneError(null);
                        }}
                        onBlur={() => {
                          if (phone.trim() && !isKenyanMobile(phone)) {
                            setPhoneError("Enter a Kenyan mobile number, e.g. 0712 345 678.");
                          }
                        }}
                        placeholder="e.g. 0712 345 678"
                        inputMode="tel"
                        autoComplete="tel"
                        aria-invalid={Boolean(phoneError)}
                        aria-describedby={phoneError ? "send-phone-error" : undefined}
                        className={cn("min-h-11 rounded-xl px-3.5 text-sm", phoneError && "border-danger")}
                      />
                    </Field>
                    {phoneError && (
                      <p id="send-phone-error" role="alert" className="-mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {phoneError}
                      </p>
                    )}

                    <Field label="Message (optional)" hint={`A short note - ${MESSAGE_MAX_LENGTH} characters`}>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                        rows={3}
                        maxLength={MESSAGE_MAX_LENGTH}
                        placeholder="e.g. Happy birthday! Enjoy fresh water from MajiFlow."
                        className="rounded-xl px-3.5"
                      />
                    </Field>
                  </div>
                </div>

                <div className="shrink-0 border-t border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <div className="mx-auto flex w-full max-w-md gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setStep("place")}>
                      <ArrowLeft className="size-4" aria-hidden />
                      Back
                    </Button>
                    <Button size="lg" className="flex-1 gap-2" onClick={confirmSend}>
                      <Check className="size-4" aria-hidden />
                      Send there - find stations
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
