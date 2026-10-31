import { getPreferences, updatePreferences } from "@/lib/server/account";
import { asCustomer, invalid, readJson } from "@/lib/server/account-http";
import { validatePreferencesInput } from "@/lib/server/account-validation";

export const dynamic = "force-dynamic";

/** The signed-in customer's stored order context (fulfilment + last station). */
export async function GET() {
  return asCustomer("preferences", async (user) => {
    return Response.json({ preferences: await getPreferences(user.id) });
  });
}

/**
 * Keep the server in step with the delivery/pickup choice and the station the
 * customer last opened, so a new device resumes where they left off.
 */
export async function PATCH(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("preferences", async (user) => {
    const result = validatePreferencesInput(parsed.body);
    if ("errors" in result) return invalid(result.errors);
    return Response.json({ preferences: await updatePreferences(user.id, result.preferences) });
  });
}
