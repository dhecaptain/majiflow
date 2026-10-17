import { getProfile, listAddresses, saveAddress } from "@/lib/server/account";
import { asCustomer, invalid, readJson } from "@/lib/server/account-http";
import { validateAddressInput } from "@/lib/server/account-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return asCustomer("list addresses", async (user) => Response.json({ addresses: await listAddresses(user.id) }));
}

/** Save a delivery address; the same place saved again is merged, not duplicated. */
export async function POST(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("save address", async (user) => {
    const profile = await getProfile(user.id);
    const result = validateAddressInput(parsed.body, profile?.phone || null);
    if ("errors" in result) return invalid(result.errors);
    const address = await saveAddress(user.id, result.address);
    return Response.json({ address, addresses: await listAddresses(user.id) }, { status: 201 });
  });
}
