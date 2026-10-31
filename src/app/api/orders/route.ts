import type { NextRequest } from "next/server";
import { reportFailure } from "@/lib/monitoring";
import { getOptionalCustomer } from "@/lib/server/auth";
import { createOrder, listOrders, publicOrder, staffOrder, validateOrder } from "@/lib/server/order-store";
import { asStaff } from "@/lib/server/staff-http";

export const dynamic = "force-dynamic";

/**
 * Order feed for station staff (their own stations only) and the platform
 * admin (everything). Customers read their orders through /api/account.
 */
export async function GET(request: NextRequest) {
  return asStaff(request, "list orders", async (principal) => {
    const { searchParams } = request.nextUrl;
    const businessId = searchParams.get("businessId") ?? undefined;
    if (principal.kind === "station" && businessId && !principal.stationIds.includes(businessId)) {
      return Response.json({ error: "You can only view orders for your own station." }, { status: 403 });
    }
    const orders = await listOrders({
      businessId,
      // A station account only ever reads its own stations' orders.
      businessIds: principal.kind === "station" ? principal.stationIds : undefined,
      status: searchParams.get("status") ?? undefined,
      phone: searchParams.get("phone") ?? undefined,
    });
    const visible =
      principal.kind === "admin" ? orders : orders.filter((order) => principal.stationIds.includes(order.businessId));
    return Response.json({ orders: visible.map(staffOrder) });
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { order, errors } = validateOrder(body);
  if (!order || errors) {
    return Response.json(
      {
        error: "Please fix the highlighted fields and try again.",
        fields: errors ?? { _form: "Invalid order payload" },
      },
      { status: 422 }
    );
  }
  // Ownership comes from the session only; guests still check out without one.
  const customer = await getOptionalCustomer();
  if (customer) order.customerUserId = customer.id;
  try {
    const { order: created, created: isNew } = await createOrder(order);
    return Response.json({ order: publicOrder(created) }, { status: isNew ? 201 : 200 });
  } catch (error) {
    await reportFailure("order", "Could not save an order.", {
      businessId: order.businessId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      { error: "We could not save your order. Please try again." },
      { status: 500 }
    );
  }
}
