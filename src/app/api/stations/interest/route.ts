import { reportFailure } from "@/lib/monitoring";
import { getCurrentUser } from "@/lib/server/auth";
import { recordStationInterest } from "@/lib/server/station-interest";
import { toE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Remember that a customer wants a station near them.
 *
 * Works for guests too, so a phone number is enough; a signed-in customer is
 * linked to their account instead of being identified only by number.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const area = typeof data.area === "string" ? data.area.trim().slice(0, 120) : null;
  const businessId = typeof data.businessId === "string" ? data.businessId.trim().slice(0, 180) : null;
  const rawLat = typeof data.lat === "number" ? data.lat : null;
  const rawLng = typeof data.lng === "number" ? data.lng : null;
  const lat = rawLat !== null && Number.isFinite(rawLat) && Math.abs(rawLat) <= 90 ? rawLat : null;
  const lng = rawLng !== null && Number.isFinite(rawLng) && Math.abs(rawLng) <= 180 ? rawLng : null;

  const user = await getCurrentUser();
  const phone = toE164(typeof data.phone === "string" ? data.phone : null) ?? user?.phone ?? null;

  if (!phone && !user) {
    return Response.json(
      { error: "Add your number so we can tell you when a station opens." },
      { status: 422 }
    );
  }

  try {
    await recordStationInterest({
      userId: user?.id ?? null,
      phone,
      area: area || null,
      lat,
      lng,
      businessId: businessId || null,
    });
    return Response.json({ ok: true });
  } catch (error) {
    await reportFailure("store", "Could not record a station request.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "We could not save that. Please try again." }, { status: 500 });
  }
}
