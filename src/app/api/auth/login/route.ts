import { AuthenticationError, authenticateUser, createSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const user = await authenticateUser(
      typeof data.email === "string" ? data.email : "",
      typeof data.password === "string" ? data.password : ""
    );
    await createSession(user.id);
    return Response.json({ user });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Could not sign in." }, { status: 500 });
  }
}
