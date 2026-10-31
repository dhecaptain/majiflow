import { renewSession } from "@/lib/server/auth";

export async function GET() {
  // Renewing here keeps an active customer's session alive; the cookie and the
  // database row are extended together.
  const user = await renewSession();
  return Response.json({ user });
}
