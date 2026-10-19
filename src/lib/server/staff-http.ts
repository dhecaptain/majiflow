import { reportFailure } from "@/lib/monitoring";
import { resolveStaff, type StaffPrincipal } from "@/lib/server/order-access";

/**
 * Runs an order-operations route as station staff or the platform admin.
 * 401 without either, 503 when the session store is unreachable.
 */
export async function asStaff(
  request: Request,
  action: string,
  handler: (principal: StaffPrincipal) => Promise<Response>
): Promise<Response> {
  let principal: StaffPrincipal | null;
  try {
    principal = await resolveStaff(request);
  } catch (error) {
    await reportFailure("store", "Staff session lookup failed.", {
      action,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Order operations are temporarily unavailable. Please try again." }, { status: 503 });
  }
  if (!principal) {
    return Response.json({ error: "Sign in with your station account to manage orders." }, { status: 401 });
  }
  return handler(principal);
}
