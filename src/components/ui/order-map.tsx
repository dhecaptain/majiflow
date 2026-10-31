"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type * as Leaflet from "leaflet";
import type { OrderLocation } from "@/lib/types";
import {
  createBaseMap,
  addressPin,
  finitePoint,
  loadLeaflet,
  stationPin,
  youPin,
  type LeafletNS,
  type MapPoint,
} from "@/lib/leaflet-client";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import "leaflet/dist/leaflet.css";

export type { MapPoint };

/**
 * Live order map (client-only). Shows the station, the delivery address as
 * a fallback pin, and - while the customer is sharing GPS - their moving dot
 * with an accuracy circle and the recent path.
 */
export function OrderMap({
  station,
  address,
  location,
  history = [],
  className = "",
}: {
  station?: MapPoint;
  address?: MapPoint;
  location?: OrderLocation | null;
  history?: OrderLocation[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const customerRef = useRef<{ marker: Leaflet.Marker; circle: Leaflet.Circle } | null>(null);
  const lineRef = useRef<Leaflet.Polyline | null>(null);
  const flewRef = useRef(false);
  const propsRef = useRef({ location, history });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    propsRef.current = { location, history };
  });

  const stationKey = station ? `${station.lat},${station.lng},${station.label ?? ""}` : "";
  const addressKey = address ? `${address.lat},${address.lng},${address.label ?? ""}` : "";

  useEffect(() => {
    let disposed = false;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      const L = await loadLeaflet();
      if (disposed || !containerRef.current) return;

      const center: [number, number] = finitePoint(station)
        ? [station!.lat, station!.lng]
        : finitePoint(address)
          ? [address!.lat, address!.lng]
          : [-1.2921, 36.8219];

      const map = createBaseMap(L, containerRef.current, center, 13, {
        onTilesReady: () => setReady(true),
      });
      mapRef.current = map;

      if (finitePoint(station)) {
        L.marker([station!.lat, station!.lng], { icon: stationPin(L), keyboard: false })
          .addTo(map)
          .bindTooltip(station!.label ?? "Station", { direction: "top", offset: [0, -10] });
      }
      if (finitePoint(address)) {
        L.marker([address!.lat, address!.lng], { icon: addressPin(L), keyboard: false })
          .addTo(map)
          .bindTooltip(address!.label ?? "Delivery address", { direction: "top", offset: [0, -8] });
      }

      const latest = propsRef.current.location;
      if (latest) applyCustomer(L, map, latest, propsRef.current.history, customerRef, lineRef, flewRef);
    })();

    return () => {
      disposed = true;
      customerRef.current?.marker.remove();
      customerRef.current?.circle.remove();
      customerRef.current = null;
      lineRef.current?.remove();
      lineRef.current = null;
      flewRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Station/address pins are static for the life of the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationKey, addressKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    void loadLeaflet().then((L) => {
      if (mapRef.current !== map) return;
      applyCustomer(L, map, location, history, customerRef, lineRef, flewRef);
    });
  }, [location, history]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-muted ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Live order map"
      />
      {!ready && <MapPlaceholder />}
    </div>
  );
}

function applyCustomer(
  L: LeafletNS,
  map: Leaflet.Map,
  location: OrderLocation,
  history: OrderLocation[],
  customerRef: MutableRefObject<{ marker: Leaflet.Marker; circle: Leaflet.Circle } | null>,
  lineRef: MutableRefObject<Leaflet.Polyline | null>,
  flewRef: MutableRefObject<boolean>
) {
  const latlng: [number, number] = [location.lat, location.lng];

  if (!customerRef.current) {
    const marker = L.marker(latlng, { icon: youPin(L), keyboard: false, zIndexOffset: 500 })
      .addTo(map)
      .bindTooltip("Customer · live", { direction: "top", offset: [0, -10] });
    const circle = L.circle(latlng, {
      radius: location.accuracy ?? 25,
      color: "var(--success)",
      weight: 1,
      fillColor: "var(--success)",
      fillOpacity: 0.12,
    }).addTo(map);
    customerRef.current = { marker, circle };
  } else {
    customerRef.current.marker.setLatLng(latlng);
    customerRef.current.circle.setLatLng(latlng);
    customerRef.current.circle.setRadius(location.accuracy ?? 25);
  }

  if (history.length > 1) {
    const pts = history.slice(-80).map((h) => [h.lat, h.lng]) as [number, number][];
    if (lineRef.current) lineRef.current.setLatLngs(pts);
    else lineRef.current = L.polyline(pts, { color: "var(--brand)", weight: 2, opacity: 0.45, dashArray: "6 8" }).addTo(map);
  }

  if (!flewRef.current) {
    flewRef.current = true;
    map.setView(latlng, 15, { animate: true });
  }
}
