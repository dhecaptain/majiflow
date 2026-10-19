/**
 * Where the customer was in the station → item → cart journey, so "back" and
 * "keep shopping" links return them to the same search, station or item.
 */
export type JourneyStep = "browse" | "station";

export const JOURNEY_FALLBACK: Record<JourneyStep, string> = {
  browse: "/browse",
  station: "/browse",
};

const ALLOWED: Record<JourneyStep, RegExp> = {
  browse: /^\/browse(?:\?[^#]*)?$/,
  station: /^\/browse\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)?(?:#menu)?$/,
};

/** Only same-site journey paths are honoured; anything else falls back. */
export function safeJourneyHref(step: JourneyStep, value: string | null | undefined): string {
  if (typeof value === "string" && value.length <= 300 && ALLOWED[step].test(value)) return value;
  return JOURNEY_FALLBACK[step];
}

export function browseHref(city: string, query: string): string {
  const params = new URLSearchParams();
  if (city && city !== "All cities") params.set("city", city);
  if (query.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}
