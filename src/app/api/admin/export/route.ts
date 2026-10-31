import { desc, gte } from "drizzle-orm";
import { toCsv } from "@/lib/csv";
import { authorizeConsoleRequest } from "@/lib/server/admin-http";
import {
  listAdminStations,
  listAdminUsers,
  parseInsightRange,
  rangeStart,
  STATION_STATE_LABEL,
} from "@/lib/server/admin-insights";
import { getDatabase } from "@/lib/server/db";
import { orders } from "@/lib/server/db/schema";
import type { Order } from "@/lib/types";

const MAX_ROWS = 10_000;

function attachment(name: string, body: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="majiflow-${name}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** CSV downloads for the console: `?kind=stations|users|orders&days=7|30|90`. */
export async function GET(request: Request) {
  const authorization = await authorizeConsoleRequest(request);
  if (authorization.response) return authorization.response;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");

  try {
    if (kind === "stations") {
      const stations = await listAdminStations();
      return attachment(
        "stations",
        toCsv(
          ["Station", "State", "City", "Address", "Owner", "Owner email", "Owner phone", "Plan", "Subscription", "Paid", "Monthly fee (KES)", "Visible products", "Orders (30 days)", "Delivered value 30 days (KES)", "Orders (all time)", "Last order", "Issues", "Suspension reason", "Created"],
          stations.map((s) => [s.name, STATION_STATE_LABEL[s.state], s.city, s.area, s.ownerName, s.ownerEmail, s.ownerPhone, s.plan, s.subscriptionStatus, s.paid, s.monthlyFee, s.visibleProducts, s.orders30d, s.deliveredValue30d, s.ordersAllTime, s.lastOrderAt, s.issues.join("; "), s.suspensionReason, s.createdAt])
        )
      );
    }

    if (kind === "users") {
      const rows = [];
      for (let page = 1; rows.length < MAX_ROWS; page += 1) {
        const result = await listAdminUsers({ page });
        rows.push(...result.users);
        if (rows.length >= result.total || !result.users.length) break;
      }
      return attachment(
        "users",
        toCsv(
          ["Name", "Email", "Phone", "Role", "Disabled", "Joined", "Orders", "Delivered value (KES)", "Last order", "Stations owned"],
          rows.map((u) => [u.name, u.email, u.phone, u.role, u.disabled, u.createdAt, u.orders, u.deliveredValue, u.lastOrderAt, u.stations])
        )
      );
    }

    if (kind === "orders") {
      const days = parseInsightRange(url.searchParams.get("days"));
      const { db } = await getDatabase();
      const rows = await db
        .select({ data: orders.data })
        .from(orders)
        .where(gte(orders.placedAt, rangeStart(new Date(), days)))
        .orderBy(desc(orders.placedAt))
        .limit(MAX_ROWS);
      return attachment(
        `orders-${days}d`,
        toCsv(
          ["Order", "Placed", "Station", "Customer", "Phone", "Status", "Payment", "Payment state", "Fulfilment", "Items", "Subtotal (KES)", "Delivery (KES)", "Total (KES)", "Area"],
          rows.map(({ data }) => {
            const o = data as Order;
            return [o.orderNumber, o.placedAt, o.businessName, o.customerName, o.customerPhone, o.status, o.payment, o.paymentState, o.fulfilment ?? "delivery", o.items?.reduce((n, i) => n + i.quantity, 0) ?? 0, o.subtotal, o.deliveryFee, o.total, o.address?.estate ?? ""];
          })
        )
      );
    }

    return Response.json({ error: "Choose kind=stations, users or orders." }, { status: 400 });
  } catch {
    return Response.json({ error: "Could not build the export." }, { status: 500 });
  }
}
