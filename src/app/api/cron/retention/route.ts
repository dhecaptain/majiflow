import { reportFailure } from "@/lib/monitoring";
import { safeEqual } from "@/lib/server/admin";
import { applyOrderRetention } from "@/lib/server/order-store";

export const dynamic = "force-dynamic";

/**
 * Daily retention sweep, run by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; any other caller is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const redacted = await applyOrderRetention();
    return Response.json({ ok: true, redacted });
  } catch (error) {
    await reportFailure("store", "Order retention sweep failed.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Retention sweep failed." }, { status: 500 });
  }
}
