import { applyReversalResult, callbackTokenOk, parseReversalResult } from "@/lib/server/payments";
import { reportFailure } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Daraja's reversal result (DARAJA_RESULT_URL, with the callback token). This
 * is what finally settles a refund: confirmed on success, failed otherwise.
 */
export async function POST(request: Request) {
  if (!callbackTokenOk(request)) {
    await reportFailure("payment", "Rejected a reversal result.", { reason: "missing or wrong callback token" });
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = parseReversalResult(body);
  if (!result) return Response.json({ error: "Unrecognised reversal result." }, { status: 400 });
  const refund = await applyReversalResult(result);
  if (!refund) {
    await reportFailure("payment", "Reversal result for an unknown refund.", { conversationId: result.conversationId });
    return Response.json({ error: "Unknown refund." }, { status: 404 });
  }
  if (refund.status === "failed") {
    await reportFailure("payment", "A refund reversal failed - support must follow up.", { refundId: refund.id });
  }
  return Response.json({ ok: true, status: refund.status });
}
