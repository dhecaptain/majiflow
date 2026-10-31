import { reportFailure } from "@/lib/monitoring";
import { AuthenticationError } from "@/lib/server/auth";
import { ProductNotFoundError, ProductValidationError } from "@/lib/server/station-products";

/** Shared error mapping for the owner product routes. */
export async function productErrorResponse(error: unknown, action: string) {
  if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 401 });
  if (error instanceof ProductNotFoundError) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof ProductValidationError) {
    return Response.json({ error: error.message, fields: error.fields }, { status: 422 });
  }
  await reportFailure("store", `Could not ${action}.`, {
    reason: error instanceof Error ? error.message : "unknown",
  });
  return Response.json({ error: `Could not ${action}. Please try again.` }, { status: 500 });
}
