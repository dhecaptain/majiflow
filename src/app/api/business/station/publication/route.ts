import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import {
  publishBusiness,
  StationNotFoundError,
  StationPublicationError,
  StationUnauthorizedError,
} from "@/lib/server/station-publication";

export const dynamic = "force-dynamic";

/**
 * Publishes an owner's station. The authoritative publication gate
 * (approved application, complete listing, eligible trial/paid subscription)
 * runs inside publishBusiness before isPublished can change.
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

  try {
    const owner = await requireBusinessOwner();
    const business = await publishBusiness(businessId, owner.id);
    return Response.json({ business });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof StationNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StationUnauthorizedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof StationPublicationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json({ error: "Could not publish your station." }, { status: 500 });
  }
}
