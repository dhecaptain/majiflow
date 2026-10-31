"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type * as Leaflet from "leaflet";
import { createBaseMap, loadLeaflet, NAIROBI_CENTER } from "@/lib/leaflet-client";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { reverseGeocode, type GeocodedAddress } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

export interface CenterPinMapProps {
  /** Initial centre; defaults to Nairobi. */
  center?: { lat: number; lng: number } | null;
  /** A point to pan to. Change `nonce` to force a re-pan to the same point. */
  focus?: { lat: number; lng: number; nonce?: number } | null;
  zoom?: number;
  /** Called with the settled coordinate (debounced reverse-geocode already applied). */
  onChange: (point: { lat: number; lng: number }) => void;
  /** Called with the reverse-geocoded address for the settled point. */
  onAddress?: (address: GeocodedAddress | null, point: { lat: number; lng: number }) => void;
  className?: string;
}

/**
 * Uber-style location picker: a pin pinned to the centre of the viewport stays
 * put while the map moves underneath it. When the pan settles we reverse-geocode
 * the centre and report it up.
 */
export function CenterPinMap({
  center,
  focus,
  zoom = 16,
  onChange,
  onAddress,
  className = "",
}: CenterPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const settledRef = useRef<{ lat: number; lng: number } | null>(null);
  const geocodeSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  const onAddressRef = useRef(onAddress);
  const focusRef = useRef(focus);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressRef.current = onAddress;
  });

  useEffect(() => {
    focusRef.current = focus;
    const map = mapRef.current;
    if (!map || !focus) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - focus.lat) < 1e-5 && Math.abs(c.lng - focus.lng) < 1e-5) return;
    map.setView([focus.lat, focus.lng], map.getZoom(), { animate: true });
  }, [focus]);

  useEffect(() => {
    let disposed = false;
    let debounce: number | undefined;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      const L = await loadLeaflet();
      if (disposed || !containerRef.current) return;
      const start: [number, number] = center ? [center.lat, center.lng] : NAIROBI_CENTER;
      const map = createBaseMap(L, containerRef.current, start, zoom, {
        theme: "muted",
        zoomControl: false,
        scrollWheelZoom: true,
        onTilesReady: () => setReady(true),
      });
      mapRef.current = map;
      map.whenReady(() => map.invalidateSize());

      const initialFocus = focusRef.current;
      if (initialFocus) map.setView([initialFocus.lat, initialFocus.lng], zoom, { animate: false });

      const settle = () => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(async () => {
          const c = map.getCenter();
          const point = { lat: c.lat, lng: c.lng };
          const last = settledRef.current;
          if (last && Math.abs(last.lat - point.lat) < 1e-6 && Math.abs(last.lng - point.lng) < 1e-6) {
            return;
          }
          settledRef.current = point;
          onChangeRef.current(point);
          const seq = ++geocodeSeq.current;
          setLocating(true);
          const address = await reverseGeocode(point.lat, point.lng);
          if (disposed || seq !== geocodeSeq.current) return;
          setLocating(false);
          onAddressRef.current?.(address, point);
        }, 450);
      };

      map.on("moveend", settle);
      // Report the initial centre too (helps prefill on open).
      settle();
    })();

    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- build the map once; centre changes are driven internally
  }, [zoom]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Move the map to set your delivery point"
      />
      {!ready && <MapPlaceholder />}
      {/* Fixed centre pin */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <span className="flex flex-col items-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[0_8px_20px_-4px_rgba(0,87,230,.7)] ring-4 ring-white">
            <MapPin className="size-5" />
          </span>
          <span className="h-3 w-1.5 rounded-b-full bg-[var(--brand)]" />
        </span>
      </div>
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur">
        {locating ? "Finding this spot…" : "Move the map to adjust"}
      </span>
    </div>
  );
}
