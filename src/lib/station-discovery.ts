import type { Business } from "@/lib/types";
import { businesses, getBusinessesByCity } from "@/lib/data/businesses";
import { haversineMeters } from "@/lib/geo";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";

/** Radii (km) searched from nearest outwards until at least one station matches. */
export const DISCOVERY_RADII_KM = [3, 5, 10, 20, 40] as const;

/** How far a station is assumed to reach when it has not published a radius. */
export const DEFAULT_DELIVERY_RADIUS_KM = 8;

export interface DiscoveredStation {
  business: Business;
  distanceKm?: number;
  /** True when the station is currently open (ordering available). */
  open: boolean;
  /** True when the station delivers to the customer's point. */
  delivers: boolean;
  /** Rough minutes for a rider to reach the customer. */
  etaMinutes?: number;
}

export interface DiscoveryQuery {
  city: string;
  query?: string;
  location?: { lat: number; lng: number } | null;
  /** When true, ignore the city filter and rank purely by distance. */
  byDistance?: boolean;
  /** Used to work out whether a station can take orders right now. */
  now?: Date;
}

export interface DiscoveryResult {
  results: DiscoveredStation[];
  /** The radius that produced the first match, when searching by distance. */
  radiusKm: number | null;
  /** Stations that reach the customer's point. */
  delivering: DiscoveredStation[];
  /** Stations close by that do not deliver there yet. */
  nearby: DiscoveredStation[];
}

function matchesQuery(business: Business, q: string): boolean {
  return (
    business.name.toLowerCase().includes(q) ||
    business.city.toLowerCase().includes(q) ||
    business.estates.some((e) => e.toLowerCase().includes(q)) ||
    business.tagline.toLowerCase().includes(q)
  );
}

/** The radius a station actually delivers within. */
export function deliveryRadiusKm(business: Business): number {
  return business.deliveryRadiusKm ?? DEFAULT_DELIVERY_RADIUS_KM;
}

/**
 * Rough rider time: the station's own average plus a minute per kilometre of
 * distance. It is a promise-free estimate, only used to sort and to set
 * expectations.
 */
export function estimateEtaMinutes(business: Business, distanceKm: number): number {
  return Math.round(business.avgDeliveryMinutes + distanceKm * 2);
}

/** Rank: delivering stations first, then open ones, then nearest. */
function rankStations(a: DiscoveredStation, b: DiscoveredStation): number {
  if (a.delivers !== b.delivers) return a.delivers ? -1 : 1;
  if (a.open !== b.open) return a.open ? -1 : 1;
  if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
  if (a.distanceKm === undefined) return 1;
  if (b.distanceKm === undefined) return -1;
  return a.distanceKm - b.distanceKm;
}

function split( results: DiscoveredStation[]): { delivering: DiscoveredStation[]; nearby: DiscoveredStation[] } {
  return {
    delivering: results.filter((r) => r.delivers),
    nearby: results.filter((r) => !r.delivers),
  };
}

/** Only the stations that reach the customer's point. */
export function deliverableStations(stations: DiscoveredStation[]): DiscoveredStation[] {
  return stations.filter((s) => s.delivers);
}

/**
 * Pure station search shared by the locator page and the location step, so the
 * radius/haversine rules live in exactly one place.
 */
export function discoverStations({
  city,
  query = "",
  location,
  byDistance = false,
  now = new Date(),
}: DiscoveryQuery): DiscoveryResult {
  const source = byDistance ? businesses : getBusinessesByCity(city);
  const q = query.trim().toLowerCase();
  const searched = q ? source.filter((b) => matchesQuery(b, q)) : source;

  const finite = (b: Business) => Number.isFinite(b.lat) && Number.isFinite(b.lng);
  const hasPoint =
    location && Number.isFinite(location.lat) && Number.isFinite(location.lng) ? location : null;
  const isOpen = (b: Business) => getBusinessOrderBlockReason(b, now) === null;

  if (!byDistance || !hasPoint) {
    const results = searched
      .map((business) => {
        const distanceKm =
          hasPoint && finite(business) ? haversineMeters(hasPoint, business) / 1000 : undefined;
        return {
          business,
          distanceKm,
          open: isOpen(business),
          delivers: distanceKm !== undefined && distanceKm <= deliveryRadiusKm(business),
          etaMinutes:
            distanceKm !== undefined ? estimateEtaMinutes(business, distanceKm) : undefined,
        };
      })
      .sort(rankStations);
    return { results, radiusKm: null, ...split(results) };
  }

  const radiusKm =
    DISCOVERY_RADII_KM.find((radius) =>
      searched.some(
        (b) => finite(b) && haversineMeters(hasPoint, b) / 1000 <= radius
      )
    ) ?? DISCOVERY_RADII_KM[DISCOVERY_RADII_KM.length - 1];

  const results = searched
    .filter(finite)
    .map((business) => {
      const distanceKm = haversineMeters(hasPoint, business) / 1000;
      return {
        business,
        distanceKm,
        open: isOpen(business),
        delivers: distanceKm <= deliveryRadiusKm(business),
        etaMinutes: estimateEtaMinutes(business, distanceKm),
      };
    })
    .filter((r) => r.distanceKm <= radiusKm)
    .sort(rankStations);

  return { results, radiusKm, ...split(results) };
}
