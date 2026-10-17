import { planReorder } from "@/lib/account";
import { businesses } from "@/lib/data/businesses";
import { asCustomer, notFound } from "@/lib/server/account-http";
import { getCustomerOrder } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * Rebuild one of the customer's past orders against today's catalog. Nothing
 * is charged here: the client adds the returned lines to the cart and checkout
 * re-prices and re-validates them.
 */
export async function POST(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asCustomer("reorder", async (user) => {
    const order = await getCustomerOrder(id, user.id);
    if (!order) return notFound();
    const plan = planReorder(order, businesses);
    if ("error" in plan) return Response.json({ error: plan.error }, { status: 409 });
    return Response.json({ plan });
  });
}
