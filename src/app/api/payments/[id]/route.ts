import { reconcilePayment } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/** Payment status for the checkout poller. Reading also sweeps stale pending payments to timeout. */
export async function GET(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const payment = await reconcilePayment(id);
  if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });
  return Response.json({
    payment: {
      id: payment.id,
      orderIds: payment.orderIds,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      failureReason: payment.failureReason ?? null,
      providerReceipt: payment.providerReceipt ?? null,
      updatedAt: payment.updatedAt,
    },
  });
}
