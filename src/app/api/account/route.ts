import { deleteCustomerAccount } from "@/lib/server/account";
import { asCustomer, readJson } from "@/lib/server/account-http";
import { logoutCurrentSession, verifyUserPassword } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Permanently delete the signed-in customer's account after re-confirming the password. */
export async function DELETE(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  return asCustomer("delete account", async (user) => {
    const password = (parsed.body as { password?: unknown } | null)?.password;
    if (!(await verifyUserPassword(user.id, password))) {
      return Response.json(
        { error: "That password is incorrect.", fields: { password: "That password is incorrect." } },
        { status: 403 }
      );
    }
    await deleteCustomerAccount(user.id);
    await logoutCurrentSession();
    return Response.json({ deleted: true });
  });
}
