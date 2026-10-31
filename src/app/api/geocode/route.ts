import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import type { NextRequest } from "next/server";
import { reportFailure } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

interface NominatimAddress {
  road?: string;
  street?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  lane?: string;
  residential?: string;
  service?: string;
  track?: string;
  cycleway?: string;
  steps?: string;
  house_number?: string;
  building?: string;
  neighbourhood?: string;
  city_block?: string;
  quarter?: string;
  hamlet?: string;
  suburb?: string;
  borough?: string;
  city_district?: string;
  village?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

export interface GeocodeResult {
  street?: string;
  estate?: string;
  city?: string;
  building?: string;
  area?: string;
  displayName?: string;
  /** True when the street came from a nearest-road lookup rather than the point itself. */
  streetApprox?: boolean;
}

function cleanName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s+(ward|division|location|sublocation|sub-location|area)$/i, "")
    .trim();
  return cleaned || value;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchNominatim(lat: number, lng: number): Promise<NominatimResponse | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18` +
    `&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "MajiFlow/0.1 (MajiFlow)",
    },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NominatimResponse;
}

/**
 * Nearest named road via Overpass - used when the point itself has no road in
 * OSM's address breakdown (common in informal or mapped-only-by-building
 * areas). Excludes motorways/trunks so we return a delivery street, not a
 * highway that happens to be overhead.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function fetchNearestStreet(
  lat: number,
  lng: number,
  radius: number
): Promise<string | undefined> {
  const query =
    `[out:json][timeout:8];` +
    `way(around:${radius},${lat},${lng})[highway][name]` +
    `[highway!~"^(motorway|trunk|construction|proposed|raceway)$"];` +
    `out tags center 30;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MajiFlow/0.1 (MajiFlow)",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        elements?: { center?: { lat: number; lon: number }; tags?: { name?: string } }[];
      };
      let best: string | undefined;
      let bestDist = Infinity;
      for (const el of data.elements ?? []) {
        const name = el.tags?.name;
        const c = el.center;
        if (!name || !c) continue;
        const d = haversine(lat, lng, c.lat, c.lon);
        if (d < bestDist) {
          bestDist = d;
          best = name;
        }
      }
      return best;
    } catch {
      /* try the next mirror */
    }
  }
  return undefined;
}

/**
 * Photon (komoot) reverse geocoder - fast single request over OSM data that
 * returns the nearest named street even when the exact point isn't on a road.
 * Used alongside Nominatim (which gives a richer address breakdown) to make the
 * street capture fast and reliable on the phone.
 */
interface PhotonResult {
  street?: string;
  estate?: string;
  city?: string;
}

async function fetchPhoton(lat: number, lng: number): Promise<PhotonResult | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&limit=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MajiFlow/0.1 (MajiFlow)" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { properties?: Record<string, unknown> }[];
    };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const type = p.type as string | undefined;
    const name = p.name as string | undefined;
    const street = (p.street as string) || (type === "street" && name ? name : undefined);
    const estate = cleanName((p.district as string) || (p.locality as string)) ?? undefined;
    const city = cleanName(p.city as string) ?? undefined;
    return { street, estate, city };
  } catch {
    return null;
  }
}

async function fetchGeocode(
  lat: number,
  lng: number,
  accuracy?: number
): Promise<GeocodeResult | null> {
  const [data, photon] = await Promise.all([fetchNominatim(lat, lng), fetchPhoton(lat, lng)]);
  const a = data?.address ?? {};
  const nomDisplay = data?.display_name;

  const estate = cleanName(
    a.neighbourhood ||
      a.city_block ||
      a.quarter ||
      a.hamlet ||
      a.suburb ||
      a.borough ||
      a.city_district ||
      a.village ||
      photon?.estate
  );
  const city = cleanName(
    a.city || a.town || a.village || a.municipality || a.county || a.state || photon?.city
  );
  const building = a.building || undefined;
  const houseNumber = a.house_number;

  const nomStreet =
    a.road ||
    a.street ||
    a.pedestrian ||
    a.footway ||
    a.path ||
    a.lane ||
    a.residential ||
    a.service ||
    a.track ||
    undefined;
  let street = nomStreet || photon?.street || undefined;
  let streetApprox = Boolean(street && !nomStreet);
  if (!street) {
    const radius = Math.min(200, Math.max(50, Math.round((accuracy ?? 80) * 1.5)));
    const nearest = await fetchNearestStreet(lat, lng, radius);
    if (nearest) {
      street = nearest;
      streetApprox = true;
    }
  }

  const area = [estate, city].filter(Boolean).join(", ") || undefined;
  return {
    street,
    estate,
    city,
    building: building || undefined,
    area: area || undefined,
    displayName: [houseNumber, nomDisplay].filter(Boolean).join(" ") || nomDisplay,
    streetApprox: street ? streetApprox : undefined,
  };
}

export async function GET(request: NextRequest) {
  const limited = await limitResponse([{ key: `geocode:ip:${clientIp(request)}`, rule: LIMITS.geocodePerIp }]);
  if (limited) return limited;
  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const rawAccuracy = Number(searchParams.get("accuracy"));
  const accuracy = Number.isFinite(rawAccuracy) && rawAccuracy > 0 ? rawAccuracy : undefined;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return Response.json({ error: "Invalid coordinates", result: null }, { status: 400 });
  }

  let lastFailure: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetchGeocode(lat, lng, accuracy);
      if (result) {
        return Response.json(
          { result },
          { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
        );
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "unknown";
    }
  }
  if (lastFailure) {
    // A point with no address is a normal answer; an unreachable lookup is not.
    await reportFailure("geocode", "Reverse geocoding failed for a delivery location.", {
      reason: lastFailure,
    });
  }
  return Response.json({ result: null });
}
