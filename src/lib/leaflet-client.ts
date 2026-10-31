import type * as Leaflet from "leaflet";

export type LeafletNS = typeof import("leaflet");

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

export const NAIROBI_CENTER: [number, number] = [-1.2921, 36.8219];

export type TileTheme = "streets" | "muted";

let leafletPromise: Promise<LeafletNS> | null = null;

export function loadLeaflet(): Promise<LeafletNS> {
  if (!leafletPromise) {
    leafletPromise = (
      // @ts-expect-error - the ESM build ships without type declarations for this path
      import("leaflet/dist/leaflet-src.esm.js")
        .catch(() => import("leaflet"))
    ).then((mod) => {
      const m = mod as { default?: LeafletNS };
      return m.default ?? (mod as LeafletNS);
    });
  }
  return leafletPromise;
}
/**
 * A calm basemap with the POI clutter stripped out, so brand-colored station
 * pins are the loudest thing on the map. CARTO's light tiles are keyless.
 */
function mutedTiles(L: LeafletNS, map: Leaflet.Map) {
  return L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
}

function streetsTiles(L: LeafletNS, map: Leaflet.Map) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

export interface BaseMapOptions {
  theme?: TileTheme;
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  /** Called once the first batch of tiles has painted. */
  onTilesReady?: () => void;
}

export function createBaseMap(
  L: LeafletNS,
  el: HTMLElement,
  center: [number, number] = NAIROBI_CENTER,
  zoom = 13,
  options: BaseMapOptions = {}
): Leaflet.Map {
  const {
    theme = "streets",
    zoomControl = true,
    scrollWheelZoom = true,
    onTilesReady,
  } = options;
  const map = L.map(el, {
    attributionControl: true,
    zoomControl: false,
    scrollWheelZoom,
  }).setView(center, zoom);
  const tiles = theme === "muted" ? mutedTiles(L, map) : streetsTiles(L, map);
  if (onTilesReady) tiles.once("load", onTilesReady);
  if (zoomControl) L.control.zoom({ position: "bottomright" }).addTo(map);
  return map;
}

function dot(color: string, size: number, glow?: string) {
  return `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:${glow ?? "0 1px 5px rgba(0,0,0,.45)"}"></span>`;
}

/**
 * Teardrop pin with an optional short label in the head, KFC/Maps style.
 * The tip sits on the coordinate, so the anchor is the bottom point.
 */
function teardrop(
  L: LeafletNS,
  opts: { color: string; label?: string; selected?: boolean; closed?: boolean }
) {
  const { color, label = "", selected = false, closed = false } = opts;
  const w = selected ? 34 : 28;
  const h = selected ? 44 : 36;
  const fill = closed ? "var(--map-pin-closed)" : color;
  const scale = selected ? "transform:scale(1.02);" : "";
  const halo = selected
    ? `<span style="position:absolute;left:50%;top:${h - 20}px;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:9999px;background:${fill};opacity:.18"></span>`
    : "";
  const html = `
    <span style="position:relative;display:block;width:${w}px;height:${h}px;${scale}">
      ${halo}
      <svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:relative;display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">
        <path d="M14 0C6.3 0 0 6.2 0 13.9 0 24 14 36 14 36s14-12 14-22.1C28 6.2 21.7 0 14 0Z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
        ${label ? `<text x="14" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#fff">${label}</text>` : `<circle cx="14" cy="14" r="5" fill="#fff"/>`}
      </svg>
    </span>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

/** Station pin; pass `closed` to grey it out and `label` for the initials. */
export function stationPin(L: LeafletNS, label = "", closed = false, color = "var(--brand)") {
  return teardrop(L, { color, label, closed });
}

export function selectedPin(L: LeafletNS, label = "", color = "var(--brand)") {
  return teardrop(L, { color, label, selected: true });
}

/** The customer's location: a pulsing aqua dot. */
export function userPin(L: LeafletNS, size = 16) {
  return L.divIcon({
    className: "",
    html: `<span style="position:relative;display:block;width:${size}px;height:${size}px">
      <span style="position:absolute;inset:0;border-radius:9999px;background:var(--brand);opacity:.35;animation:ping-slow 2.4s cubic-bezier(0,0,.2,1) infinite"></span>
      <span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:var(--brand);border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></span>
    </span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Backwards-compatible aliases used by the live order map. */
export const youPin = (L: LeafletNS, size = 16) => userPin(L, size);
export const selectedStationPin = selectedPin;

export function addressPin(L: LeafletNS, size = 14) {
  return L.divIcon({
    className: "",
    html: dot("var(--muted-foreground)", size, "0 1px 4px rgba(0,0,0,.4)"),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function finitePoint(p: { lat?: number; lng?: number } | null | undefined): boolean {
  return (
    !!p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
}
