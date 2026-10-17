import { filterOrders, isOrderFilter } from "@/lib/account";
import { asCustomer } from "@/lib/server/account-http";
import { listOrders } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

/** The signed-in customer's own orders, newest first. `?filter=active|past|all`. */
export async function GET(request: Request) {
  return asCustomer("list orders", async (user) => {
    const raw = new URL(request.url).searchParams.get("filter") ?? "all";
    if (!isOrderFilter(raw)) return Response.json({ error: "Unknown filter" }, { status: 400 });
    const orders = filterOrders(await listOrders({ customerUserId: user.id }), raw);
    return Response.json({ orders, total: orders.length });
  });
}
