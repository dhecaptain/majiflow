import { setStationSuspended } from "@/lib/server/admin-insights";
import { adminErrorResponse, authorizeConsoleRequest, readJsonObject } from "@/lib/server/admin-http";
import { revalidateStations } from "@/lib/server/catalog";

/** Suspend a station (off browse and checkout at once) or reinstate it. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/stations/[id]">) {
  const authorization = await authorizeConsoleRequest(request);
  if (authorization.response) return authorization.response;
  const body = await readJsonObject(request);
  if (!body || typeof body.suspended !== "boolean") {
    return Response.json({ error: "Send { suspended: true | false }." }, { status: 400 });
  }
  try {
    const station = await setStationSuspended((await params).id, body.suspended, body.reason);
    await revalidateStations();
    return Response.json({ station });
  } catch (error) {
    return adminErrorResponse(error, "Could not update the station.");
  }
}
