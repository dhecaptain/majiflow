import { notifyStatusChange, reportFailure } from "@/lib/monitoring";
import { isOrderStatus } from "@/lib/order-status";
import { wantsOrderUpdates } from "@/lib/server/account";
import { getOrder, publicOrder, updateOrder } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ order: publicOrder(order) });
}

// Payment state is written server-side only (verified provider callbacks in
// /api/payments). Clients - including vendor screens - cannot set it here.
const PATCHABLE = new Set(["status", "eta"]);

export async function PATCH(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid patch" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === "paymentState") {
      return Response.json(
        { error: "Payment state is confirmed server-side after checkout - it cannot be set here." },
        { status: 400 }
      );
    }
    if (!PATCHABLE.has(key)) continue;
    if (key === "status" && !isOrderStatus(value)) {
      return Response.json({ error: "Unknown status" }, { status: 400 });
    }
    if (key === "eta" && typeof value !== "string") {
      return Response.json({ error: "ETA must be a string" }, { status: 400 });
    }
    patch[key] = value;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No patchable fields supplied" }, { status: 400 });
  }

  const before = await getOrder(id);
  let order;
  try {
    order = await updateOrder(id, patch);
  } catch (error) {
    await reportFailure("store", "Could not update an order.", {
      orderId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "We could not update the order. Please try again." }, { status: 500 });
  }
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  if (typeof patch.status === "string" && patch.status !== before?.status) {
    // Failures inside the notification seam are reported there, so this cannot
    // turn a saved status change into an error response. Account holders who
    // opted out of order updates are skipped.
    if (await wantsOrderUpdates(order.customerUserId)) {
      await notifyStatusChange({ id: order.id, status: order.status }, order.customerPhone);
    }
  }

  return Response.json({ order: publicOrder(order) });
}
