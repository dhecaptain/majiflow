import { reportFailure } from "@/lib/monitoring";
import { isOrderStatus } from "@/lib/order-status";
import { assignRider, moveOrder, validateRider } from "@/lib/server/fulfillment";
import { actorFor, canManageOrder, optionalStaff } from "@/lib/server/order-access";
import { getOrder, publicOrder, staffOrder, updateOrder } from "@/lib/server/order-store";
import { asStaff } from "@/lib/server/staff-http";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * The order id is the customer's unguessable tracking link, so anyone holding
 * it gets the tracking view. The owning station and the admin get the full
 * operational record.
 */
export async function GET(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const staff = await optionalStaff(request);
  const view = staff && canManageOrder(staff, order) ? staffOrder(order) : publicOrder(order);
  return Response.json({ order: view });
}

const MAX_ETA = 40;

/**
 * Station/admin fulfilment actions:
 *   { status, reason? }              lifecycle move (enforced server-side)
 *   { status: "rider_assigned", rider: { name, phone } }   assign or reassign a rider
 *   { eta }                          update the promised arrival
 * Payment state is never writable here - only verified provider callbacks set it.
 */
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
  const input = body as Record<string, unknown>;
  if ("paymentState" in input) {
    return Response.json(
      { error: "Payment state is confirmed server-side after checkout - it cannot be set here." },
      { status: 400 }
    );
  }
  if (input.status !== undefined && !isOrderStatus(input.status)) {
    return Response.json({ error: "Unknown status" }, { status: 400 });
  }
  if (input.eta !== undefined && (typeof input.eta !== "string" || input.eta.length > MAX_ETA)) {
    return Response.json({ error: "ETA must be a short text, e.g. \"25 min\"." }, { status: 400 });
  }
  if (input.status === undefined && input.eta === undefined) {
    return Response.json({ error: "No patchable fields supplied" }, { status: 400 });
  }

  return asStaff(request, "update order", async (principal) => {
    const authorize = (order: { businessId: string }) => canManageOrder(principal, order);
    const actor = actorFor(principal);
    try {
      let riderToken: string | undefined;
      let order;
      if (input.status === "rider_assigned") {
        const checked = validateRider(input.rider);
        if ("errors" in checked) {
          return Response.json({ error: "Add the rider's details.", fields: checked.errors }, { status: 422 });
        }
        const result = await assignRider({ orderId: id, rider: checked.rider, actor, authorize });
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
        order = result.order;
        riderToken = result.token;
      } else if (isOrderStatus(input.status)) {
        const result = await moveOrder({ orderId: id, to: input.status, actor, authorize, reason: input.reason as string });
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
        order = result.order;
      }
      if (typeof input.eta === "string") {
        const current = order ?? (await getOrder(id));
        if (!current || !authorize(current)) return Response.json({ error: "Order not found" }, { status: 404 });
        order = (await updateOrder(id, { eta: input.eta.trim() || undefined })) ?? current;
      }
      return Response.json({
        order: staffOrder(order!),
        ...(riderToken ? { riderLink: `/rider/${riderToken}` } : {}),
      });
    } catch (error) {
      await reportFailure("store", "Could not update an order.", {
        orderId: id,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return Response.json({ error: "We could not update the order. Please try again." }, { status: 500 });
    }
  });
}
