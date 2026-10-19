import { markNotificationsRead } from "@/lib/server/account";
import { asCustomer } from "@/lib/server/account-http";

export const dynamic = "force-dynamic";

export async function POST() {
  return asCustomer("mark notifications read", async (user) =>
    Response.json({ preferences: await markNotificationsRead(user.id) })
  );
}
