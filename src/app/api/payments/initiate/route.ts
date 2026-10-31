import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import { initiatePayment } from "@/lib/server/payments";
import { reportFailure } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Start (or rejoin) payment for already-created pending orders. The amount is
 * always the orders' server-side totals - the client only names the orders.
 */
export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `payment:ip:${clientIp(request)}`, rule: LIMITS.paymentPerIp }]);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const orderIds = Array.isArray(o.orderIds) ? o.orderIds.filter((id): id is string => typeof id === "string") : [];
  try {
    const { payment, created, testMode } = await initiatePayment({
      orderIds,
      phone: typeof o.phone === "string" ? o.phone : "",
      method: o.method === "mpesa" ? "mpesa" : "cod",
      idempotencyKey: typeof o.idempotencyKey === "string" ? o.idempotencyKey : "",
    });
    return Response.json(
      {
        payment: {
          id: payment.id,
          orderIds: payment.orderIds,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
        },
        testMode,
      },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start payment.";
    const status = /not be found|required|Choose|Nothing to charge|Kenyan number/.test(message) ? 400 : 422;
    await reportFailure("payment", "Payment initiation failed.", { reason: message });
    return Response.json({ error: message }, { status });
  }
}
