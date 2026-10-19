import {
  applyProviderOutcome,
  devCallbacksAllowed,
  parseDarajaCallback,
  type ProviderOutcome,
} from "@/lib/server/payments";
import { reportFailure } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Provider callback. Accepts genuine Daraja STK payloads, plus an explicit
 * dev-test shape that is refused in production (and refused everywhere unless
 * dev mode is active). Applying the same callback twice changes nothing.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const daraja = parseDarajaCallback(body);
  if (daraja) {
    const payment = await applyProviderOutcome({
      checkoutRequestId: daraja.checkoutRequestId,
      outcome: daraja.outcome,
      receipt: daraja.receipt,
      amount: daraja.amount,
      detail: daraja.detail,
    });
    if (!payment) return Response.json({ error: "Unknown transaction." }, { status: 404 });
    return Response.json({ ok: true, status: payment.status });
  }

  const o = body as Record<string, unknown>;
  const isTestHook = o.test === true;
  if (!isTestHook || !devCallbacksAllowed()) {
    await reportFailure("payment", "Rejected a payment callback.", {
      reason: isTestHook ? "test callbacks are disabled here" : "unrecognised payload",
    });
    return Response.json({ error: "Unrecognised callback payload." }, { status: 400 });
  }

  const outcome = o.outcome as ProviderOutcome;
  if (!["success", "failed", "cancelled", "timeout"].includes(outcome)) {
    return Response.json({ error: "Unknown test outcome." }, { status: 400 });
  }
  const payment = await applyProviderOutcome({
    paymentId: typeof o.paymentId === "string" ? o.paymentId : undefined,
    outcome,
    receipt: typeof o.receipt === "string" ? o.receipt : undefined,
    amount: typeof o.amount === "number" ? o.amount : undefined,
    detail: "Development test callback (never used in production).",
  });
  if (!payment) return Response.json({ error: "Unknown payment." }, { status: 404 });
  return Response.json({ ok: true, status: payment.status });
}
