import { logoutCurrentSession } from "@/lib/server/auth";

export async function POST() {
  try {
    await logoutCurrentSession();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not sign out." }, { status: 500 });
  }
}
