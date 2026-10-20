import { reportFailure } from "@/lib/monitoring";
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
  if (!isAdminRequest(request)) return Response.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const stationSlug = (body as Record<string, unknown> | null)?.stationSlug;
  if (typeof stationSlug !== "string" || !stationSlug.trim()) {
    return Response.json({ error: "Choose the station to link." }, { status: 422 });
  }
  try {
    const result = await approveApplicationForStation(id, stationSlug.trim());
    return Response.json({ stationId: result.stationId });
  } catch (error) {
    if (error instanceof StationLinkError) return Response.json({ error: error.message }, { status: error.status });
    await reportFailure("store", "Could not approve a business application.", {
      applicationId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Could not approve the application." }, { status: 500 });
  }
}
