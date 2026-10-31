import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import { AuthenticationError, authenticateUser, createSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `login:ip:${clientIp(request)}`, rule: LIMITS.loginPerIp }]);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const account = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (account) {
      const tooMany = await limitResponse([{ key: `login:account:${account}`, rule: LIMITS.loginPerAccount }]);
      if (tooMany) return tooMany;
    }
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
