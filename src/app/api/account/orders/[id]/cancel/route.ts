import { cancelBlockReason } from "@/lib/account";
import { asCustomer, notFound } from "@/lib/server/account-http";
import { moveOrder } from "@/lib/server/fulfillment";
import { publicOrder } from "@/lib/server/order-store";
import { PAYMENT_TIMEOUT_MS } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/** Customer self-cancel, allowed only before acceptance and while no payment can land. */
export async function POST(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asCustomer("cancel order", async (user) => {
    const result = await moveOrder({
      orderId: id,
      to: "cancelled",
      actor: "customer",
      authorize: (order) => order.customerUserId === user.id,
      guard: (order) => cancelBlockReason(order, Date.now(), PAYMENT_TIMEOUT_MS),
      reason: "Cancelled by you before the station accepted it.",
    });
    if (!result.ok && result.status === 404) return notFound();
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    return Response.json({ order: publicOrder(result.order) });
  });
}
