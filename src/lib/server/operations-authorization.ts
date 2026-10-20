import { AuthenticationError, AuthorizationError, requireOperations } from "@/lib/server/auth";

export async function authorizeOperationsRequest() {
  try {
    return { user: await requireOperations(), response: null };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { user: null, response: Response.json({ error: error.message }, { status: 401 }) };
    }
    if (error instanceof AuthorizationError) {
      return { user: null, response: Response.json({ error: error.message }, { status: 403 }) };
    }
    throw error;
  }
}
