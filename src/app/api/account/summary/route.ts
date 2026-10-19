import { buildAccountEvents, computeAccountMetrics, countUnread, filterOrders } from "@/lib/account";
import { getPreferences, listAddresses } from "@/lib/server/account";
import { asCustomer } from "@/lib/server/account-http";
import { listOrders, publicOrder } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

/** Dashboard data for the signed-in customer only. */
export async function GET() {
  return asCustomer("summary", async (user) => {
    const [orders, addresses, preferences] = await Promise.all([
      listOrders({ customerUserId: user.id }),
      listAddresses(user.id),
      getPreferences(user.id),
    ]);
    return Response.json({
      metrics: computeAccountMetrics(orders),
      activeOrders: filterOrders(orders, "active").slice(0, 3).map(publicOrder),
      recentOrders: orders.slice(0, 4).map(publicOrder),
      addresses: addresses.slice(0, 3),
      addressCount: addresses.length,
      unreadNotifications: countUnread(buildAccountEvents(orders), preferences.notificationsReadAt),
    });
  });
}
