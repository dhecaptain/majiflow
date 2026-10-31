"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Clock3, MapPin, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/button-loader";
import { useBrowseContext } from "@/components/order/browse-context";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useMotionSafe } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { CITIES } from "@/lib/constants";
import { discoverStations } from "@/lib/station-discovery";
import { cn } from "@/lib/utils";

export function StationsDrawer({
  open,
  onClose,
  onSetLocation,
  mounted,
}: {
  open: boolean;
  onClose: () => void;
  onSetLocation: () => void;
  mounted: boolean;
}) {
  const { location, selectedStation, selectStation, setCurrentStep, canGoToStep } = useBrowseContext();
  const { hydrated: sessionHydrated } = useOrderSession();
  const { reduce, transition } = useMotionSafe();
  const panelRef = useFocusTrap<HTMLElement>(open);

  const hasCoordinates =
    typeof location?.lat === "number" &&
    Number.isFinite(location.lat) &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lng);
  const city = CITIES.find((item) => item.toLowerCase() === location?.city?.toLowerCase()) ?? "All cities";
  const stations = useMemo(() => {
    const nearby = location
      ? discoverStations({
          city,
          location: hasCoordinates ? { lat: location.lat!, lng: location.lng! } : null,
          byDistance: hasCoordinates,
        }).results.slice(0, 8)
      : [];

    if (!selectedStation || nearby.some(({ business }) => business.id === selectedStation.id)) {
      return nearby;
    }

    const selected = discoverStations({ city: selectedStation.city }).results.find(
      ({ business }) => business.id === selectedStation.id
    );
    return selected ? [selected, ...nearby] : nearby;
  }, [location, city, hasCoordinates, selectedStation]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const openLocation = useCallback(() => {
    onClose();
    onSetLocation();
  }, [onClose, onSetLocation]);

  const continueToStation = () => {
    if (!selectedStation) return;
    setCurrentStep("cart");
    onClose();
  };

  const panelTransition = reduce ? { duration: 0 } : (transition ?? { duration: 0.3, ease: [0.16, 1, 0.3, 1] });

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close stations drawer"
            onClick={onClose}
            className="absolute inset-0 h-full w-full rounded-none bg-black/50 p-0 hover:bg-black/50"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose a water station"
            className="absolute inset-y-0 right-0 flex h-dvh w-full flex-col bg-white pt-[env(safe-area-inset-top)] shadow-2xl sm:max-w-[380px]"
            initial={reduce ? { opacity: 1 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={panelTransition}
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-5">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-bold leading-tight text-foreground">Hi there</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick a station near you</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close stations drawer"
                className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            {!sessionHydrated ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <ButtonLoader className="size-7" />
                Finding your station…
              </div>
            ) : !location && !selectedStation ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-7 py-8 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Store className="size-8" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-foreground">No station selected</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Set your location to see stations near you.
                </p>
                <Button size="lg" className="mt-5" onClick={openLocation}>
                  <MapPin className="size-4" aria-hidden /> Set Location
                </Button>
              </div>
            ) : stations.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-7 py-8 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Store className="size-8" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-foreground">No nearby stations yet</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Try another delivery location to find a station.
                </p>
                <Button size="lg" variant="outline" className="mt-5" onClick={openLocation}>
                  <MapPin className="size-4" aria-hidden /> Change Location
                </Button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {location ? "Nearby stations" : "Your selected station"}
                  </p>
                  <button
                    type="button"
                    onClick={openLocation}
                    className="text-xs font-semibold text-brand underline underline-offset-2"
                  >
                    {location ? "Change location" : "Set location"}
                  </button>
                </div>
                <ul className="flex flex-col gap-2" aria-label="Nearby water stations">
                  {stations.map(({ business, distanceKm, etaMinutes, open: isOpen }) => {
                    const selected = selectedStation?.id === business.id;
                    return (
                      <li key={business.id}>
                        <button
                          type="button"
                          onClick={() => selectStation(business.id)}
                          aria-pressed={selected}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                            selected
                              ? "border-brand bg-brand/5 ring-1 ring-brand/20"
                              : "border-border bg-white hover:border-brand/40 hover:bg-surface-2"
                          )}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-brand">
                            <Store className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{business.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span className={isOpen ? "text-success" : "text-muted-foreground"}>
                                {isOpen ? "Open" : "Closed"}
                              </span>
                              {distanceKm !== undefined && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" aria-hidden /> {distanceKm < 1 ? "<1 km" : `${distanceKm.toFixed(1)} km`}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="size-3" aria-hidden /> ~{etaMinutes ?? business.avgDeliveryMinutes} min
                              </span>
                            </span>
                          </span>
                          <span className={cn("shrink-0 text-xs font-semibold", selected ? "text-brand" : "text-foreground")}>
                            {selected ? <Check className="size-4" aria-label="Selected" /> : "Select"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <footer className="shrink-0 border-t border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button size="lg" className="w-full" disabled={!selectedStation || !canGoToStep("cart")} onClick={continueToStation}>
                Continue <ChevronRight className="size-4" aria-hidden />
              </Button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
