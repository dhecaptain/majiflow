import { CITIES, CITY_COORDS, ESTATE_COORDS } from "@/lib/constants";

/**
 * Shared browser-geolocation helpers.
 *
 * The product captures a delivery location by asking the customer to allow
 * location access (no manual typing). A real map/tiles API plugs in later -
 * these helpers only turn the native Geolocation API into a small, serializable
 * shape plus the offline fallbacks already used elsewhere.
 */

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
  /** True when the coordinates are an approximate town fallback, not a GPS fix. */
  approx?: boolean;
}

/** Why the browser can't give us GPS, or null when it can. */
export function geolocationUnavailableReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext)
    return "Location needs a secure connection. Open MajiFlow over https and allow location, then try again.";
  if (typeof navigator === "undefined" || !("geolocation" in navigator))
    return "This browser can't share location.";
  return null;
}

/** Approximate coordinates derived from the selected town/city. */
export function townLocation(city: string): CapturedLocation {
  const coords = CITY_COORDS[city] ?? CITY_COORDS.Nairobi;
  return { lat: coords.lat, lng: coords.lng, at: new Date().toISOString(), approx: true };
}

/** Promise wrapper over the native Geolocation API. */
export function captureCurrentLocation(options?: PositionOptions): Promise<CapturedLocation> {
  return new Promise((resolve, reject) => {
    const reason = geolocationUnavailableReason();
    if (reason) {
      reject(new Error(reason));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          at: new Date().toISOString(),
        });
      },
      (err) => reject(err),
      options ?? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function isPermissionDenied(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as GeolocationPositionError).code
      : undefined;
  return (
    typeof window !== "undefined" &&
    "GeolocationPositionError" in window &&
    code === window.GeolocationPositionError.PERMISSION_DENIED
  );
}

/** A fix this close is good enough to put the pin on a door. */
export const PRECISE_ACCURACY_M = 25;

export interface PreciseLocationOptions {
  /** Stop as soon as a fix is at least this accurate (metres). */
  targetAccuracy?: number;
  /** Longest time to keep improving the fix before settling for the best one. */
  maxWaitMs?: number;
  /** Called with every better fix, so a map can follow it as it sharpens. */
  onUpdate?: (location: CapturedLocation) => void;
}

/**
 * A precise fix. The first position a device reports is usually a rough
 * cell/Wi-Fi guess, so instead of taking it, watch the GPS for a few seconds
 * and keep the most accurate reading, stopping early once it is good enough.
 * Rejects only when no fix arrives at all.
 */
export function capturePreciseLocation({
  targetAccuracy = PRECISE_ACCURACY_M,
  maxWaitMs = 10000,
  onUpdate,
}: PreciseLocationOptions = {}): Promise<CapturedLocation> {
  return new Promise((resolve, reject) => {
    const reason = geolocationUnavailableReason();
    if (reason) {
      reject(new Error(reason));
      return;
    }
    let best: CapturedLocation | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      if (best) resolve(best);
      else reject(error ?? new Error("We couldn't get your location."));
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: CapturedLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          at: new Date().toISOString(),
        };
        const better = !best || (fix.accuracy ?? Infinity) <= (best.accuracy ?? Infinity);
        if (better) {
          best = fix;
          onUpdate?.(fix);
        }
        if ((best?.accuracy ?? Infinity) <= targetAccuracy) finish();
      },
      (err) => {
        // A denied permission ends it; other errors only matter when nothing arrived yet.
        if (isPermissionDenied(err) || !best) finish(err);
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 }
    );
    timer = setTimeout(() => finish(), maxWaitMs);
  });
}

/**
 * Best-effort capture: a precise GPS fix first (see `capturePreciseLocation`),
 * then the network/IP-based fix when GPS gives nothing (indoors, desktops). A
 * denied permission is not retried.
 */
export async function captureLocationBestEffort(
  options: Pick<PreciseLocationOptions, "onUpdate"> = {}
): Promise<CapturedLocation> {
  try {
    return await capturePreciseLocation(options);
  } catch (err) {
    if (isPermissionDenied(err)) throw err;
    const fix = await captureCurrentLocation({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
    options.onUpdate?.(fix);
    return fix;
  }
}

/** Human-readable reason for a failed geolocation attempt. */
export function geolocationErrorMessage(err: unknown): string {
  if (err instanceof Error && !("code" in err)) return err.message;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as GeolocationPositionError).code
      : undefined;
  const P = typeof window !== "undefined" && "GeolocationPositionError" in window
    ? window.GeolocationPositionError
    : undefined;
  if (P && code === P.PERMISSION_DENIED)
    return "Location permission is blocked. Allow location for this site in your browser settings, then try again.";
  if (P && code === P.POSITION_UNAVAILABLE)
    return "Your device couldn't determine its position. Turn on location services and try again.";
  if (P && code === P.TIMEOUT)
    return "Getting your location took too long. Check that location services are on, then try again.";
  return "We couldn't get your location. Check that location services are on and try again.";
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest known estate/town to a coordinate, for label hints. */
export function nearestPlace(lat: number, lng: number): { estate?: string; city?: string } {
  let estate: string | undefined;
  let best = Infinity;
  for (const [name, c] of Object.entries(ESTATE_COORDS)) {
    const d = haversineMeters({ lat, lng }, c);
    if (d < best) {
      best = d;
      estate = name;
    }
  }
  let city: string | undefined;
  best = Infinity;
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    const d = haversineMeters({ lat, lng }, c);
    if (d < best) {
      best = d;
      city = name;
    }
  }
  return { estate, city };
}

/** Pick the first candidate that is a known town/city (keeps the town dropdown valid). */
export function resolveCity(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    if (c && (CITIES as readonly string[]).includes(c)) return c;
  }
  return candidates.find((c): c is string => Boolean(c));
}

export interface GeocodedAddress {
  estate?: string;
  city?: string;
  street?: string;
  building?: string;
  /** Ready-to-display "estate, city" string. */
  area?: string;
  displayName?: string;
  /** True when the street came from a nearest-road lookup, not the point itself. */
  streetApprox?: boolean;
}

/**
 * Reverse-geocode a coordinate into a human address (area/estate, town, street,
 * building). The call goes through our own `/api/geocode` route so the browser
 * never talks to Nominatim directly (avoids CORS/cache fragility); the route
 * owns retries and the OSM User-Agent. Returns null on any failure so callers
 * can fall back to `nearestPlace()`.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  accuracy?: number
): Promise<GeocodedAddress | null> {
  const accuracyParam =
    typeof accuracy === "number" && Number.isFinite(accuracy) ? `&accuracy=${Math.round(accuracy)}` : "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}${accuracyParam}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { result: GeocodedAddress | null };
      if (data.result) return data.result;
    } catch {
      /* retry once */
    }
  }
  return null;
}

/**
 * Best-effort display label for a captured location: prefer the street, then the
 * estate/area, then the town - so the "street / area" line is never blank.
 */
export function composeArea(
  address: { street?: string; estate?: string; city?: string; building?: string } | null
): string {
  if (!address) return "";
  return (
    address.street ||
    address.estate ||
    address.building ||
    address.city ||
    ""
  );
}

/** "350 m", "1.2 km", "14 km": short distance labels for map bubbles and lists. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
