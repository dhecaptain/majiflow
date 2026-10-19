import { publicOrder, updateOrderConsent } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * Customer consent for one order, from the tracking page:
 *   { location?: boolean, smsUpdates?: boolean }
 * Turning location off deletes the stored trail straight away.
 */
export async function POST(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const change: { location?: boolean; smsUpdates?: boolean } = {};
  if (typeof input.location === "boolean") change.location = input.location;
  if (typeof input.smsUpdates === "boolean") change.smsUpdates = input.smsUpdates;
  if (Object.keys(change).length === 0) {
    return Response.json({ error: "Send location and/or smsUpdates as true or false." }, { status: 400 });
  }
  const order = await updateOrderConsent(id, change);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ order: publicOrder(order) });
}
