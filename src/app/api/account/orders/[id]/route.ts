import { cancelBlockReason } from "@/lib/account";
import { asCustomer, notFound } from "@/lib/server/account-http";
import { getCustomerOrder, publicOrder } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asCustomer("order detail", async (user) => {
    const order = await getCustomerOrder(id, user.id);
    if (!order) return notFound();
    return Response.json({ order: publicOrder(order), cancelBlockReason: cancelBlockReason(order) });
  });
}
