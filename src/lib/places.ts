import type { PlaceKind, PlaceResult } from "@/lib/place-types";

export type { PlaceKind, PlaceResult };

/**
 * Client-side place search.
 *
 * The sheet calls our own `/api/places` route (never the geocoders directly)
 * and debounces the typing so a customer on a slow connection does not fire a
 * request per keystroke.
 */

export const MIN_PLACE_QUERY = 2;
export const PLACE_SEARCH_DEBOUNCE_MS = 320;

export interface PlaceSearchOptions {
  /** Bias the results around the customer, so "Kibera" ranks above "Kibera, Baringo". */
  lat?: number;
  lng?: number;
  signal?: AbortSignal;
}

export async function searchPlaces(
  query: string,
  options: PlaceSearchOptions = {}
): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_PLACE_QUERY) return [];

  const params = new URLSearchParams({ q: trimmed });
  if (typeof options.lat === "number" && typeof options.lng === "number") {
    params.set("lat", String(options.lat));
    params.set("lng", String(options.lng));
  }

  const res = await fetch(`/api/places?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { places?: PlaceResult[] };
  return body.places ?? [];
}

/** "Kibera, Nairobi County" - the one-line form used in lists and headers. */
export function placeLine(place: Pick<PlaceResult, "label" | "sublabel">): string {
  return place.sublabel ? `${place.label}, ${place.sublabel}` : place.label;
}

/** Human label for what the pin landed on. */
export function placeKindLabel(kind: PlaceKind): string {
  switch (kind) {
    case "estate":
      return "Estate or area";
    case "street":
      return "Street";
    case "area":
      return "Area";
    case "city":
      return "Town";
    default:
      return "Place";
  }
}
