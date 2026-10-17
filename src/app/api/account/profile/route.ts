import { getProfile, listAddresses, updateProfile } from "@/lib/server/account";
import { asCustomer, invalid, notFound, readJson } from "@/lib/server/account-http";
import { validateProfileInput } from "@/lib/server/account-validation";

export const dynamic = "force-dynamic";

/** Profile plus saved addresses - everything checkout needs to prefill. */
export async function GET() {
  return asCustomer("get profile", async (user) => {
    const [profile, addresses] = await Promise.all([getProfile(user.id), listAddresses(user.id)]);
    if (!profile) return notFound("Account");
    return Response.json({ profile, addresses });
  });
}

/** Edit name and phone. Email is the sign-in identity and stays fixed. */
export async function PATCH(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("update profile", async (user) => {
    const result = validateProfileInput(parsed.body);
    if ("errors" in result) return invalid(result.errors);
    const profile = await updateProfile(user.id, result.profile);
    if (!profile) return notFound("Account");
    return Response.json({ profile });
  });
}
