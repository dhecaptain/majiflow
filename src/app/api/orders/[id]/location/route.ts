import { reportFailure } from "@/lib/monitoring";
import type { OrderLocation } from "@/lib/types";
import { canManageOrder } from "@/lib/server/order-access";
import { getOrder, locationBlockReason, recordLocation } from "@/lib/server/order-store";
import { asStaff } from "@/lib/server/staff-http";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/** The customer's live location trail - only for the station handling the order and the admin. */
export async function GET(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asStaff(request, "read order location", async (principal) => {
    const order = await getOrder(id);
    if (!order || !canManageOrder(principal, order)) return Response.json({ error: "Order not found" }, { status: 404 });
    return Response.json({
      location: order.location ?? null,
      history: order.locationHistory ?? [],
      status: order.status,
    });
  });
}

function parseLocation(body: unknown): OrderLocation | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.lat !== "number" || !Number.isFinite(b.lat)) return null;
  if (typeof b.lng !== "number" || !Number.isFinite(b.lng)) return null;
  if (b.lat < -90 || b.lat > 90 || b.lng < -180 || b.lng > 180) return null;
  const accuracy =
    typeof b.accuracy === "number" && Number.isFinite(b.accuracy) && b.accuracy >= 0
      ? b.accuracy
      : undefined;
  const at =
    typeof b.at === "string" && !Number.isNaN(Date.parse(b.at)) ? b.at : new Date().toISOString();
  return { lat: b.lat, lng: b.lng, accuracy, at };
}

export async function POST(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const location = parseLocation(body);
  if (!location) {
    return Response.json({ error: "Invalid location payload" }, { status: 400 });
  }
  try {
    // Posted from the customer's tracking page (the order id is their link).
    // Accepted only with location consent and while the order is active.
    const result = await recordLocation(id, location, locationBlockReason);
    if (!result) return Response.json({ error: "Order not found" }, { status: 404 });
    if ("error" in result) return Response.json({ error: result.error }, { status: 409 });
    return Response.json({ location: result.location, status: result.status }, { status: 201 });
  } catch (error) {
    await reportFailure("store", "Could not record a courier location.", {
      orderId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Could not record the location. Please try again." }, { status: 500 });
  }
}
