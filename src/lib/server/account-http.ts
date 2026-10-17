import { reportFailure } from "@/lib/monitoring";
import { AccountConflictError } from "@/lib/server/account";
import { AuthenticationError, requireCustomer, type AuthenticatedUser } from "@/lib/server/auth";

/**
 * Runs an account route as the signed-in customer. Answers 401 without a
 * customer session, 409 on account conflicts, and a generic 500 (with an
 * alert) on anything unexpected, so handlers only contain the happy path.
 */
export async function asCustomer(
  action: string,
  handler: (user: AuthenticatedUser) => Promise<Response>
): Promise<Response> {
  let user: AuthenticatedUser;
  try {
    user = await requireCustomer();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: "Sign in to your customer account to continue." }, { status: 401 });
    }
    await reportFailure("store", "Account session lookup failed.", {
      action,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Your account is temporarily unavailable. Please try again." }, { status: 503 });
  }

  try {
    return await handler(user);
  } catch (error) {
    if (error instanceof AccountConflictError) {
      return Response.json({ error: error.message, fields: { [error.field]: error.message } }, { status: 409 });
    }
    await reportFailure("store", `Account request failed: ${action}.`, {
      action,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

export function invalid(errors: Record<string, string>) {
  return Response.json({ error: "Please fix the highlighted fields and try again.", fields: errors }, { status: 422 });
}

export const notFound = (what = "Order") => Response.json({ error: `${what} not found` }, { status: 404 });
