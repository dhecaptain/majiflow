import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import {
  planNames,
  startFreeTrial,
  SubscriptionConflictError,
  SubscriptionError,
  SubscriptionNotFoundError,
  SubscriptionUnauthorizedError,
  type PlanName,
} from "@/lib/server/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Starts the 14-day free trial for an approved owner station.
 * Trial timestamps are generated server-side: clients cannot supply them.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const businessId = typeof payload.businessId === "string" ? payload.businessId.trim() : "";
  if (!businessId) {
    return Response.json({ error: "A business is required." }, { status: 400 });
  }

  let plan: PlanName | undefined;
  if (payload.plan !== undefined) {
    if (typeof payload.plan !== "string" || !(planNames as readonly string[]).includes(payload.plan)) {
      return Response.json({ error: "Plan is invalid." }, { status: 400 });
    }
    plan = payload.plan as PlanName;
  }

  try {
    const owner = await requireBusinessOwner();
    const subscription = await startFreeTrial(businessId, owner.id, plan);
    return Response.json({ subscription }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof SubscriptionNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SubscriptionUnauthorizedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SubscriptionConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SubscriptionError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json({ error: "Could not start the free trial." }, { status: 500 });
  }
}
