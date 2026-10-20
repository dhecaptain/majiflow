import { reportFailure } from "@/lib/monitoring";
import {
  BusinessApplicationSelfReviewError,
  updateBusinessApplicationStatus,
} from "@/lib/server/business-applications";
import { authorizeOperationsRequest } from "@/lib/server/operations-authorization";
import { isAdminRequest } from "@/lib/server/admin";
import { approveApplicationForStation, StationLinkError } from "@/lib/server/stations";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * Approve a business application and link it to a catalog station:
 *   { stationSlug }
 * From then on the owner's dashboard (and order access) is scoped to that station.
 */
export async function POST(request: Request, ctx: Context) {
  const authorization = await authorizeOperationsRequest();
  if (authorization.response && !isAdminRequest(request)) return authorization.response;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const stationSlug = (body as Record<string, unknown> | null)?.stationSlug;
  try {
    if (typeof stationSlug === "string" && stationSlug.trim()) {
      const result = await approveApplicationForStation(id, stationSlug.trim());
      return Response.json({ stationId: result.stationId });
    }
    if (authorization.response) return authorization.response;
    const application = await updateBusinessApplicationStatus(id, "approved", undefined, authorization.user.id);
    return Response.json({ application });
  } catch (error) {
    if (error instanceof StationLinkError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof BusinessApplicationSelfReviewError) return Response.json({ error: error.message }, { status: 403 });
    await reportFailure("store", "Could not approve a business application.", {
      applicationId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Could not approve the application." }, { status: 500 });
  }
}
