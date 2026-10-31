import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import { AuthenticationError, createSession, createUserAccount } from "@/lib/server/auth";

export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `register:ip:${clientIp(request)}`, rule: LIMITS.registerPerIp }]);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const user = await createUserAccount(body);
    await createSession(user.id);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 422 });
    return Response.json({ error: "Could not create account." }, { status: 500 });
  }
}
