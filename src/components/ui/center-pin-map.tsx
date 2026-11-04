"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed } from "lucide-react";
import type * as Leaflet from "leaflet";
import {
  createBaseMap,
  loadLeaflet,
  NAIROBI_CENTER,
  stationPin,
  userPin,
  type LeafletNS,
} from "@/lib/leaflet-client";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { reverseGeocode, type GeocodedAddress } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

/** Leaflet writes circle colors as SVG attributes, which cannot read CSS variables. */
const BRAND_HEX = "#0057e6";

export interface PickerStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  open: boolean;
}

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
  /** The customer's GPS fix: drawn as a blue "you are here" dot with its accuracy circle. */
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  /** Shows a "locate me" button on the map. */
  onLocate?: () => void;
  locating?: boolean;
  /** Stations to show around the pin, so the customer sees what is nearby. */
  stations?: readonly PickerStation[];
  /** The bubble above the pin: the address being picked and a short detail line. */
  label?: { title: string; detail?: string } | null;
  className?: string;
}

/**
 * Centre-pin location picker, ride-hailing style: the pin stays in the middle
 * and lifts while the map moves underneath it, then drops and shows the
 * address it landed on. When the pan settles we reverse-geocode the centre and
 * report it up.
 */
export function CenterPinMap({
  center,
  focus,
  zoom = 16,
  onChange,
  onAddress,
  userLocation,
  onLocate,
  locating: locatingUser = false,
  stations,
  label,
  className = "",
}: CenterPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const settledRef = useRef<{ lat: number; lng: number } | null>(null);
  const geocodeSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  const onAddressRef = useRef(onAddress);
  const focusRef = useRef(focus);
  const userLayerRef = useRef<{ dot: Leaflet.Marker; ring: Leaflet.Circle } | null>(null);
  const stationLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

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
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [focus]);

  useEffect(() => {
    let disposed = false;
    let debounce: number | undefined;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      const L = await loadLeaflet();
      if (disposed || !containerRef.current) return;
      LRef.current = L;
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
          setGeocoding(true);
          const address = await reverseGeocode(point.lat, point.lng);
          if (disposed || seq !== geocodeSeq.current) return;
          setGeocoding(false);
          onAddressRef.current?.(address, point);
        }, 450);
      };

      map.on("movestart", () => setMoving(true));
      map.on("moveend", () => {
        setMoving(false);
        settle();
      });
      setMapLoaded(true);
      // Report the initial centre too (helps prefill on open).
      settle();
    })();

    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      userLayerRef.current = null;
      stationLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      LRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- build the map once; centre changes are driven internally
  }, [zoom]);

  // "You are here": blue dot plus a translucent circle for the GPS accuracy.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!userLocation) {
      userLayerRef.current?.dot.remove();
      userLayerRef.current?.ring.remove();
      userLayerRef.current = null;
      return;
    }
    const at: [number, number] = [userLocation.lat, userLocation.lng];
    const radius = Math.min(Math.max(userLocation.accuracy ?? 0, 15), 1500);
    if (!userLayerRef.current) {
      const ring = L.circle(at, {
        radius,
        color: BRAND_HEX,
        weight: 1,
        opacity: 0.4,
        fillColor: BRAND_HEX,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
      const dot = L.marker(at, { icon: userPin(L), interactive: false, keyboard: false, zIndexOffset: 200 }).addTo(map);
      userLayerRef.current = { dot, ring };
    } else {
      userLayerRef.current.dot.setLatLng(at);
      userLayerRef.current.ring.setLatLng(at).setRadius(radius);
    }
  }, [userLocation, mapLoaded]);

  // Nearby stations, small and quiet so the centre pin stays the focus.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    stationLayerRef.current?.remove();
    stationLayerRef.current = null;
    if (!stations?.length) return;
    const group = L.layerGroup();
    for (const s of stations) {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
      L.marker([s.lat, s.lng], { icon: stationPin(L, "", !s.open), keyboard: false, title: s.name })
        .bindTooltip(s.name, { direction: "top", offset: [0, -30] })
        .addTo(group);
    }
    group.addTo(map);
    stationLayerRef.current = group;
  }, [stations, mapLoaded]);

  const bubbleTitle = moving ? "Release to set the spot" : geocoding ? "Finding this spot…" : (label?.title ?? "Move the map to adjust");
  const bubbleDetail = moving || geocoding ? undefined : label?.detail;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* `isolate` keeps Leaflet's high z-index panes inside the map, so the
          pin and controls drawn after it stay on top. */}
      <div
        ref={containerRef}
        className="isolate h-full w-full"
        role="application"
        aria-label="Move the map to set your delivery point"
      />
      {!ready && <MapPlaceholder />}

      {/* Fixed centre pin: lifts while the map moves, drops when it settles. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2">
        {/* Ground shadow sits exactly on the picked point. */}
        <span
          className={`absolute left-1/2 top-0 block h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 blur-[1px] transition-all duration-200 ${
            moving ? "w-3 opacity-40" : "w-4 opacity-70"
          }`}
        />
        <span
          className={`absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center transition-transform duration-200 ease-out ${
            moving ? "-translate-y-3" : "translate-y-0"
          }`}
        >
          {bubbleTitle && (
            <span className="mb-2 flex max-w-[min(280px,75vw)] flex-col items-center rounded-xl bg-foreground px-3 py-1.5 text-center text-white shadow-lg">
              <span className="w-full truncate text-xs font-semibold">{bubbleTitle}</span>
              {bubbleDetail && <span className="w-full text-[11px] leading-snug text-white/75">{bubbleDetail}</span>}
            </span>
          )}
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--brand)] shadow-[0_8px_20px_-4px_rgba(0,87,230,.7)] ring-4 ring-white">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
          <span className="h-4 w-1 rounded-b-full bg-[var(--brand)]" />
        </span>
      </div>

      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          disabled={locatingUser}
          aria-label="Go to my current location"
          className="absolute bottom-4 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white text-[var(--brand)] shadow-lg ring-1 ring-black/5 transition hover:bg-slate-50 disabled:opacity-70"
        >
          {locatingUser ? <LoaderCircle className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
        </button>
      )}
    </div>
  );
}
