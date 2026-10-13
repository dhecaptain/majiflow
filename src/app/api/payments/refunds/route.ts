import { adminKeyOk, confirmRefund, requestRefund } from "@/lib/server/payments";
import { reportFailure } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Refund lifecycle, server-to-server only (MF_ADMIN_KEY bearer required).
 * - { action: "request", paymentId, reason } opens a PENDING refund.
 * - { action: "confirm", refundId, providerReference? } confirms it after the
 *   provider confirms (Daraja reversal runs first in daraja mode).
 * A refund is never shown as complete before confirmation.
 */
export async function POST(request: Request) {
  if (!adminKeyOk(request)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  try {
    if (o.action === "request") {
      const refund = await requestRefund({
        paymentId: typeof o.paymentId === "string" ? o.paymentId : "",
        reason: typeof o.reason === "string" ? o.reason : "",
        requestedBy: "admin",
      });
      return Response.json({ refund }, { status: 201 });
    }
    if (o.action === "confirm") {
      const refund = await confirmRefund(
        typeof o.refundId === "string" ? o.refundId : "",
        typeof o.providerReference === "string" ? o.providerReference : undefined
      );
      if (!refund) return Response.json({ error: "Refund not found." }, { status: 404 });
      return Response.json({ refund });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    await reportFailure("payment", "Refund operation failed.", { reason: message });
    return Response.json({ error: message }, { status: 422 });
  }
}
