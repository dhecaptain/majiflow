import { isAdminRequest } from "@/lib/server/admin";
import { AdminActionError } from "@/lib/server/admin-insights";
import { authorizeOperationsRequest } from "@/lib/server/operations-authorization";

/**
 * Console write and export routes need both locks the console pages use: the
 * operator key session and a signed-in operations account.
 */
export async function authorizeConsoleRequest(request: Request) {
  if (!isAdminRequest(request)) {
    return { user: null, response: Response.json({ error: "Admin session required." }, { status: 401 }) };
  }
  return authorizeOperationsRequest();
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function adminErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AdminActionError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: fallback }, { status: 500 });
}
