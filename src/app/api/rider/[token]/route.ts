import { reportFailure } from "@/lib/monitoring";
import { isRiderAction, orderForRider, riderMove, riderView } from "@/lib/server/fulfillment";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ token: string }>;
}

const gone = () => Response.json({ error: "This delivery link is no longer active." }, { status: 404 });

/** The rider's view of their one assigned order. The link dies when the order closes or is reassigned. */
export async function GET(_request: Request, ctx: Context) {
  const { token } = await ctx.params;
  const order = await orderForRider(token);
  if (!order) return gone();
  return Response.json({ order: riderView(order) });
}

/** { action: "pickup" } starts the delivery; { action: "deliver" } completes it. */
export async function POST(request: Request, ctx: Context) {
  const { token } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = (body as Record<string, unknown> | null)?.action;
  if (!isRiderAction(action)) return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    const result = await riderMove(token, action);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ order: riderView(result.order) });
  } catch (error) {
    await reportFailure("store", "Rider update failed.", { reason: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "We could not save that. Please try again." }, { status: 500 });
  }
}
