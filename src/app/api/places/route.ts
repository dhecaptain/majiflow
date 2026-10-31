import type { NextRequest } from "next/server";
import { reportFailure } from "@/lib/monitoring";
import type { PlaceKind, PlaceResult } from "@/lib/place-types";

export const dynamic = "force-dynamic";

/**
 * Forward search for delivery places.
 *
 * The browser never talks to the geocoders directly: Nominatim needs a
 * User-Agent and a shared policy, and Photon is happier behind a cache. This
 * route owns both calls, keeps the results to Kenya, and returns one shape
 * regardless of which provider answered.
 */

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MajiFlow/0.1 (MajiFlow)";

/** Kenya, as minLon,minLat,maxLon,maxLat. */
const KENYA_BBOX = "33.9,-4.8,41.9,4.7";
const DEFAULT_BIAS = { lat: -1.2921, lng: 36.8219 };
const RESULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 2;

export type { PlaceKind, PlaceResult };

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

interface NominatimHit {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  category?: string;
  address?: Record<string, string>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function cleanSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s+(county|state|region|ward|division)\.?$/i, "")
    .replace(/\s+(location|sub-location|sublocation|area)$/i, "")
    .trim();
  return cleaned || undefined;
}

function joinParts(parts: (string | undefined)[]): string | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out.length ? out.join(", ") : undefined;
}

function kindFor(type: string | undefined, category: string | undefined): PlaceKind {
  const key = `${type ?? ""} ${category ?? ""}`.toLowerCase();
  if (key.includes("neighbourhood") || key.includes("suburb") || key.includes("quarter")) {
    return "estate";
  }
  if (key.includes("road") || key.includes("street") || key.includes("residential")) return "street";
  if (key.includes("city") || key.includes("town") || key.includes("village")) return "city";
  if (key.includes("county") || key.includes("state") || key.includes("district")) return "area";
  return "place";
}

function normalizePhoton(features: PhotonFeature[]): PlaceResult[] {
  const out: PlaceResult[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    const p = feature.properties ?? {};
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const name = asString(p.name);
    const street = asString(p.street);
    const district = cleanSegment(asString(p.district));
    const locality = cleanSegment(asString(p.locality));
    const city = cleanSegment(asString(p.city));
    const county = cleanSegment(asString(p.county));
    const country = asString(p.country);

    const label = name ?? street ?? district ?? city;
    if (!label) continue;

    const sublabel = joinParts([
      district && district !== label ? district : undefined,
      locality && locality !== label && locality !== district ? locality : undefined,
      city && city !== label ? city : undefined,
      county && county !== label ? county : undefined,
      country && country !== "Kenya" ? country : undefined,
    ]);

    out.push({
      id: `photon:${asString(p.osm_id) ?? `${lat},${lng}`}`,
      label: titleCase(label),
      sublabel,
      lat,
      lng,
      kind: kindFor(asString(p.type), undefined),
    });
  }
  return out;
}

function normalizeNominatim(hits: NominatimHit[]): PlaceResult[] {
  const out: PlaceResult[] = [];
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const a = hit.address ?? {};
    const estate =
      cleanSegment(a.neighbourhood) ??
      cleanSegment(a.suburb) ??
      cleanSegment(a.quarter) ??
      cleanSegment(a.city_block);
    const road = cleanSegment(a.road) ?? cleanSegment(a.pedestrian) ?? cleanSegment(a.residential);
    const city = cleanSegment(a.city) ?? cleanSegment(a.town) ?? cleanSegment(a.village);
    const county = cleanSegment(a.county) ?? cleanSegment(a.state);

    const display = hit.display_name ? hit.display_name.split(",") : [];
    const label =
      asString(hit.name) ??
      estate ??
      road ??
      city ??
      (display[0] ? display[0].trim() : undefined);
    if (!label) continue;

    const sublabel = joinParts([
      estate && estate !== label ? estate : undefined,
      road && road !== label ? road : undefined,
      city && city !== label ? city : undefined,
      county && county !== label ? county : undefined,
      a.country && a.country !== "Kenya" ? a.country : undefined,
    ]);

    out.push({
      id: `nominatim:${hit.osm_type ?? "node"}/${hit.osm_id ?? hit.place_id ?? `${lat},${lng}`}`,
      label: titleCase(label),
      sublabel,
      lat,
      lng,
      kind: kindFor(hit.type ?? hit.category, hit.category),
    });
  }
  return out;
}

async function fetchPhoton(query: string, bias: { lat: number; lng: number }): Promise<PlaceResult[]> {
  const url =
    `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}&lang=en` +
    `&bbox=${KENYA_BBOX}&lat=${bias.lat}&lon=${bias.lng}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return normalizePhoton(data.features ?? []);
}

async function fetchNominatim(query: string): Promise<PlaceResult[]> {
  const url =
    `${NOMINATIM_ENDPOINT}?format=jsonv2&addressdetails=1&countrycodes=ke&limit=${RESULT_LIMIT}` +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "Accept-Language": "en", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[];
  return normalizeNominatim(Array.isArray(data) ? data : []);
}

/** Drop duplicates that landed on the same coordinates from two providers. */
function dedupe(places: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const place of places) {
    const key = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= RESULT_LIMIT) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ places: [] });
  }

  const rawLat = Number(searchParams.get("lat"));
  const rawLng = Number(searchParams.get("lng"));
  const bias =
    Number.isFinite(rawLat) && Number.isFinite(rawLng) &&
    Math.abs(rawLat) <= 90 && Math.abs(rawLng) <= 180
      ? { lat: rawLat, lng: rawLng }
      : DEFAULT_BIAS;

  try {
    const photon = await fetchPhoton(query, bias);
    if (photon.length) {
      return Response.json(
        { places: dedupe(photon) },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
      );
    }
  } catch {
    /* fall through to Nominatim */
  }

  try {
    const nominatim = await fetchNominatim(query);
    return Response.json(
      { places: dedupe(nominatim) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    await reportFailure("geocode", "Place search failed.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ places: [] }, { status: 502 });
  }
}
