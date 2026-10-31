import { setUserDisabled } from "@/lib/server/admin-insights";
import { adminErrorResponse, authorizeConsoleRequest, readJsonObject } from "@/lib/server/admin-http";

/** Disable an account (signs it out everywhere) or restore it. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/users/[id]">) {
  const authorization = await authorizeConsoleRequest(request);
  if (authorization.response) return authorization.response;
  const body = await readJsonObject(request);
  if (!body || typeof body.disabled !== "boolean") {
    return Response.json({ error: "Send { disabled: true | false }." }, { status: 400 });
  }
  try {
    const user = await setUserDisabled((await params).id, body.disabled, authorization.user.id);
    return Response.json({ user });
  } catch (error) {
    return adminErrorResponse(error, "Could not update the account.");
  }
}
