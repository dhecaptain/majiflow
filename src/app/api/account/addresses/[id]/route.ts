import { deleteAddress, getProfile, listAddresses, setDefaultAddress, updateAddress } from "@/lib/server/account";
import { asCustomer, invalid, notFound, readJson } from "@/lib/server/account-http";
import { validateAddressInput } from "@/lib/server/account-validation";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `{ makeDefault: true }` alone switches the default; anything else is a full edit. */
export async function PATCH(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("update address", async (user) => {
    if (!UUID_RE.test(id)) return notFound("Address");
    const body = parsed.body as Record<string, unknown> | null;
    if (body && typeof body === "object" && Object.keys(body).length === 1 && body.makeDefault === true) {
      const address = await setDefaultAddress(user.id, id);
      if (!address) return notFound("Address");
      return Response.json({ address, addresses: await listAddresses(user.id) });
    }
    const profile = await getProfile(user.id);
    const result = validateAddressInput(parsed.body, profile?.phone || null);
    if ("errors" in result) return invalid(result.errors);
    const address = await updateAddress(user.id, id, result.address);
    if (!address) return notFound("Address");
    return Response.json({ address, addresses: await listAddresses(user.id) });
  });
}

export async function DELETE(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  return asCustomer("delete address", async (user) => {
    if (!UUID_RE.test(id) || !(await deleteAddress(user.id, id))) return notFound("Address");
    return Response.json({ addresses: await listAddresses(user.id) });
  });
}
