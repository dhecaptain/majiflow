import { authorizeOperationsRequest } from "@/lib/server/operations-authorization";
import {
  BusinessApplicationConflictError,
  BusinessApplicationNotFoundError,
  BusinessApplicationSelfReviewError,
  BusinessApplicationTransitionError,
  updateBusinessApplicationStatus,
} from "@/lib/server/business-applications";

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/business-applications/[id]">) {
  const authorization = await authorizeOperationsRequest();
  if (authorization.response) return authorization.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  try {
    const application = await updateBusinessApplicationStatus(
      (await params).id,
      payload.status,
      payload.rejectionReason,
      authorization.user.id
    );
    return Response.json({ application });
  } catch (error) {
    if (error instanceof BusinessApplicationNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof BusinessApplicationTransitionError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof BusinessApplicationConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof BusinessApplicationSelfReviewError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "Could not update the business application." }, { status: 500 });
  }
}
