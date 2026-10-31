"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  createBaseMap,
  finitePoint,
  loadLeaflet,
  selectedPin,
  stationPin,
  youPin,
  type LeafletNS,
} from "@/lib/leaflet-client";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import "leaflet/dist/leaflet.css";

export interface StationPinData {
  id: string;
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  deliveryFee: number;
  distanceKm?: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface StationMapProps {
  stations: StationPinData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  userLocation?: UserLocation | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  /** Full-bleed usage (e.g. the full-screen browse map): no card frame. */
  frameless?: boolean;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

export function StationMap({
  stations,
  selectedId,
  onSelect,
  userLocation,
  center,
  zoom = 12,
  className = "",
  frameless = false,
}: StationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const [ready, setReady] = useState(false);
  const markersRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const userRef = useRef<{ marker: Leaflet.Marker; circle: Leaflet.Circle } | null>(null);
  const selectRef = useRef(onSelect);
  const fittedRef = useRef(false);

  useEffect(() => {
    selectRef.current = onSelect;
  });

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    const el = containerRef.current;
    const markers = markersRef.current;
    if (!el) return;

    (async () => {
      const L = await loadLeaflet();
      if (disposed || !containerRef.current) return;
      LRef.current = L;
      const start = center ?? (userLocation ? [userLocation.lat, userLocation.lng] : undefined);
      const map = createBaseMap(L, containerRef.current, start ?? undefined, zoom, {
        onTilesReady: () => setReady(true),
      });
      mapRef.current = map;
      map.whenReady(() => map.invalidateSize());
    })();

    return () => {
      disposed = true;
      userRef.current?.marker.remove();
      userRef.current?.circle.remove();
      userRef.current = null;
      markers.forEach((m) => m.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      LRef.current = null;
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync station pins.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    for (const s of stations) {
      if (!finitePoint(s)) continue;
      seen.add(s.id);
      const selected = s.id === selectedId;
      let marker = markersRef.current.get(s.id);
      const icon = selected ? selectedPin(L) : stationPin(L);
      if (!marker) {
        marker = L.marker([s.lat, s.lng], { icon, keyboard: false, zIndexOffset: selected ? 400 : 0 })
          .addTo(map)
          .on("click", () => selectRef.current?.(s.id));
        markersRef.current.set(s.id, marker);
      } else {
        marker.setIcon(icon);
        marker.setZIndexOffset(selected ? 400 : 0);
      }
      marker.bindPopup(
        `<div style="min-width:150px;font:13px/1.35 system-ui,sans-serif">
           <strong style="display:block;color:var(--foreground)">${escapeHtml(s.name)}</strong>
           <span style="color:var(--muted-foreground)">${escapeHtml(s.city)} · KES ${s.deliveryFee} delivery${
             typeof s.distanceKm === "number" ? ` · ${s.distanceKm.toFixed(1)} km` : ""
           }</span>
           <a href="/browse/${encodeURIComponent(s.slug)}" style="display:inline-block;margin-top:6px;color:var(--brand);font-weight:600">View menu →</a>
         </div>`
      );
    }
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    if (selectedId) {
      const sel = stations.find((s) => s.id === selectedId);
      if (sel && finitePoint(sel)) map.panTo([sel.lat, sel.lng], { animate: true });
    }
  }, [stations, selectedId]);

  // Sync the user's location dot.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!userLocation || !finitePoint(userLocation)) {
      userRef.current?.marker.remove();
      userRef.current?.circle.remove();
      userRef.current = null;
      return;
    }
    const latlng: [number, number] = [userLocation.lat, userLocation.lng];
    if (!userRef.current) {
      const marker = L.marker(latlng, { icon: youPin(L), keyboard: false, zIndexOffset: 600 })
        .addTo(map)
        .bindTooltip("You", { direction: "top", offset: [0, -10] });
      const circle = L.circle(latlng, {
        radius: userLocation.accuracy ?? 60,
        color: "var(--success)",
        weight: 1,
        fillColor: "var(--success)",
        fillOpacity: 0.12,
      }).addTo(map);
      userRef.current = { marker, circle };
    } else {
      userRef.current.marker.setLatLng(latlng);
      userRef.current.circle.setLatLng(latlng);
      userRef.current.circle.setRadius(userLocation.accuracy ?? 60);
    }
  }, [userLocation]);

  // Fit bounds to results once (or when the set of stations changes meaningfully).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || selectedId) return;
    const pts = stations.filter(finitePoint).map((s) => [s.lat, s.lng] as [number, number]);
    if (pts.length === 0) return;
    if (userLocation && finitePoint(userLocation)) pts.push([userLocation.lat, userLocation.lng]);
    if (pts.length === 1) {
      map.setView(pts[0], 15, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.2), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations.map((s) => s.id).join(","), userLocation?.lat, userLocation?.lng]);

  return (
    <div
      className={`relative overflow-hidden bg-muted ${frameless ? "" : "rounded-2xl border border-border"} ${className}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Map of refill stations"
      />
      {!ready && <MapPlaceholder />}
    </div>
  );
}
