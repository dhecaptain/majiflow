import { cancelBlockReason } from "@/lib/account";
import { asCustomer, notFound } from "@/lib/server/account-http";
import { PAYMENT_TIMEOUT_MS } from "@/lib/server/payments";
import { transitionOrder } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/** Customer self-cancel, allowed only before acceptance and while no payment can land. */
export async function POST(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asCustomer("cancel order", async (user) => {
    const result = await transitionOrder(id, "cancelled", (order) =>
      order.customerUserId !== user.id ? "not-owner" : cancelBlockReason(order, Date.now(), PAYMENT_TIMEOUT_MS)
    );
    if (!result || ("error" in result && result.error === "not-owner")) return notFound();
    if ("error" in result) return Response.json({ error: result.error }, { status: 409 });
    return Response.json({ order: result.order });
  });
}
