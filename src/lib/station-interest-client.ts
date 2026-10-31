/**
 * Client for the "notify me when a station opens near me" request.
 *
 * Follows the same shape as `account-client.ts`: the caller gets a plain
 * result instead of having to handle fetch failures.
 */

export interface StationInterestRequest {
  /** Free-text area the customer is asking about, e.g. "Kawangware". */
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  businessId?: string | null;
  phone?: string | null;
}

export type StationInterestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function requestStationInterest(
  input: StationInterestRequest
): Promise<StationInterestResult> {
  try {
    const res = await fetch("/api/stations/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        area: input.area ?? undefined,
        lat: input.lat ?? undefined,
        lng: input.lng ?? undefined,
        businessId: input.businessId ?? undefined,
        phone: input.phone ?? undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? "We could not save that. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "We could not reach MajiFlow. Check your connection and try again." };
  }
}
