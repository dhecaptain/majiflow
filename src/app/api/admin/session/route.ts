import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import { endAdminSession, startAdminSession } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** Exchange the platform admin key for a short-lived admin session cookie. */
export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `admin-session:ip:${clientIp(request)}`, rule: LIMITS.adminSessionPerIp }]);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const key = (body as Record<string, unknown> | null)?.key;
  if (!(await startAdminSession(key))) {
    return Response.json({ error: "That admin key is not valid." }, { status: 401 });
  }
  return Response.json({ ok: true });
}

export async function DELETE() {
  await endAdminSession();
  return Response.json({ ok: true });
}
