import { buildAccountEvents, countUnread } from "@/lib/account";
import { getPreferences, updatePreferences } from "@/lib/server/account";
import { asCustomer, invalid, readJson } from "@/lib/server/account-http";
import { validatePreferencesInput } from "@/lib/server/account-validation";
import { listOrders } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 100;

/** Event history from the customer's own order timelines, plus their preferences. */
export async function GET() {
  return asCustomer("notifications", async (user) => {
    const [orders, preferences] = await Promise.all([listOrders({ customerUserId: user.id }), getPreferences(user.id)]);
    const events = buildAccountEvents(orders);
    return Response.json({
      events: events.slice(0, HISTORY_LIMIT),
      unread: countUnread(events, preferences.notificationsReadAt),
      preferences,
    });
  });
}

export async function PATCH(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("notification preferences", async (user) => {
    const result = validatePreferencesInput(parsed.body);
    if ("errors" in result) return invalid(result.errors);
    return Response.json({ preferences: await updatePreferences(user.id, result.preferences) });
  });
}
