import { getCurrentUser } from "@/lib/server/auth";
import { isAdminRequest } from "@/lib/server/admin";
import { listOwnerStationIds } from "@/lib/server/stations";
import type { FulfillmentActor, Order } from "@/lib/types";

/**
 * Who is operating on orders. Station staff are scoped to the stations
 * their approved applications link them to; the platform admin sees all.
 */
export type StaffPrincipal =
  | { kind: "admin" }
  | { kind: "station"; userId: string; stationIds: string[] };

/** Resolve staff from the request. Throws only when the session store is unreachable. */
export async function resolveStaff(request: Request): Promise<StaffPrincipal | null> {
  if (isAdminRequest(request)) return { kind: "admin" };
  const user = await getCurrentUser();
  if (!user || user.role !== "business_owner") return null;
  return { kind: "station", userId: user.id, stationIds: await listOwnerStationIds(user.id) };
}

/** Same, but a session-store outage reads as "not staff" (public tracking must keep working). */
export async function optionalStaff(request: Request): Promise<StaffPrincipal | null> {
  try {
    return await resolveStaff(request);
  } catch {
    return null;
  }
}

export function canManageOrder(principal: StaffPrincipal, order: Pick<Order, "businessId">): boolean {
  return principal.kind === "admin" || principal.stationIds.includes(order.businessId);
}

export function actorFor(principal: StaffPrincipal): FulfillmentActor {
  return principal.kind === "admin" ? "admin" : "station";
}
