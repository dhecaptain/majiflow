/**
 * Read models for the operations console: platform KPIs, the station
 * directory (every station, whatever its state) and the account directory.
 *
 * Aggregation over orders runs in plain functions (`summarizeOrders`,
 * `stationState`) so the numbers can be tested without a database; the
 * loaders below only fetch rows.
 */

import { and, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { parseWeeklyHours } from "@/lib/business-hours";
import { plans } from "@/lib/data/plans";
import { getDatabase } from "@/lib/server/db";
import {
  businessApplications,
  businessProducts,
  businesses,
  orders,
  sessions,
  subscriptions,
  users,
} from "@/lib/server/db/schema";
import { storefrontMissingFields } from "@/lib/server/station-publication";
import { evaluateSubscriptionEligibility, type SubscriptionRecord } from "@/lib/server/subscriptions";
import type { OrderStatus, PaymentMethod, PaymentState } from "@/lib/types";
import type { AdminUserRole, InsightRange, StationState } from "@/lib/admin-console";

export { parseInsightRange, STATION_STATE_LABEL } from "@/lib/admin-console";
export type { AdminUserRole, InsightRange, StationState } from "@/lib/admin-console";

/** Kenya has no daylight saving: East Africa Time is always UTC+3. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_PRICE = new Map<string, number>(plans.map((plan) => [plan.id, plan.monthlyPrice]));

/* ------------------------------------------------------------------ orders */

/** The slice of an order the console aggregates. */
export interface OrderFact {
  id: string;
  businessId: string;
  businessName: string;
  customerKey: string | null;
  status: OrderStatus;
  payment: PaymentMethod;
  paymentState: PaymentState;
  total: number;
  placedAt: Date;
}

export interface DailyPoint {
  /** YYYY-MM-DD in Nairobi time. */
  date: string;
  orders: number;
  delivered: number;
  value: number;
}

export interface OrderSummary {
  days: number;
  orders: number;
  previousOrders: number;
  delivered: number;
  /** Value of delivered orders: what customers actually received. */
  deliveredValue: number;
  previousDeliveredValue: number;
  averageOrderValue: number;
  /** Rejected or cancelled, as a share of orders that reached an outcome. */
  failedRate: number;
  activeNow: number;
  /** Pay-on-delivery orders still on the way: cash riders have to collect. */
  cashToCollect: number;
  cashToCollectOrders: number;
  customers: number;
  byStatus: Record<OrderStatus, number>;
  byPayment: { cod: number; mpesa: number; other: number };
  daily: DailyPoint[];
  topStations: { businessId: string; name: string; orders: number; deliveredValue: number }[];
}

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "rejected",
  "cancelled",
];
const CLOSED_BAD = new Set<OrderStatus>(["rejected", "cancelled"]);
const TERMINAL = new Set<OrderStatus>(["delivered", "rejected", "cancelled"]);

export function nairobiDate(at: Date): string {
  return new Date(at.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of the Nairobi day `days - 1` days before `now`, as an instant. */
export function rangeStart(now: Date, days: number): Date {
  const local = new Date(now.getTime() + EAT_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - EAT_OFFSET_MS - (days - 1) * DAY_MS);
}

/**
 * KPIs for the last `days` Nairobi days, compared with the same length of
 * time before it. `facts` may include older orders; they are ignored except
 * for the comparison window and the "active now" numbers.
 */
export function summarizeOrders(facts: readonly OrderFact[], days: number, now = new Date()): OrderSummary {
  const start = rangeStart(now, days);
  const previousStart = new Date(start.getTime() - days * DAY_MS);

  const current = facts.filter((f) => f.placedAt >= start && f.placedAt <= now);
  const previous = facts.filter((f) => f.placedAt >= previousStart && f.placedAt < start);

  const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  const byPayment = { cod: 0, mpesa: 0, other: 0 };
  const customers = new Set<string>();
  const stations = new Map<string, { businessId: string; name: string; orders: number; deliveredValue: number }>();
  const dailyMap = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i += 1) {
    const date = nairobiDate(new Date(start.getTime() + i * DAY_MS));
    dailyMap.set(date, { date, orders: 0, delivered: 0, value: 0 });
  }

  let delivered = 0;
  let deliveredValue = 0;
  for (const fact of current) {
    byStatus[fact.status] = (byStatus[fact.status] ?? 0) + 1;
    if (fact.payment === "cod") byPayment.cod += 1;
    else if (fact.payment === "mpesa") byPayment.mpesa += 1;
    else byPayment.other += 1;
    if (fact.customerKey) customers.add(fact.customerKey);

    const station = stations.get(fact.businessId) ?? {
      businessId: fact.businessId,
      name: fact.businessName,
      orders: 0,
      deliveredValue: 0,
    };
    station.orders += 1;

    const day = dailyMap.get(nairobiDate(fact.placedAt));
    if (day) day.orders += 1;

    if (fact.status === "delivered") {
      delivered += 1;
      deliveredValue += fact.total;
      station.deliveredValue += fact.total;
      if (day) {
        day.delivered += 1;
        day.value += fact.total;
      }
    }
    stations.set(fact.businessId, station);
  }

  const outcomes = current.filter((f) => TERMINAL.has(f.status));
  const failed = outcomes.filter((f) => CLOSED_BAD.has(f.status)).length;
  const active = facts.filter((f) => !TERMINAL.has(f.status));
  const cash = active.filter((f) => f.payment === "cod" && f.paymentState !== "success");

  return {
    days,
    orders: current.length,
    previousOrders: previous.length,
    delivered,
    deliveredValue,
    previousDeliveredValue: previous
      .filter((f) => f.status === "delivered")
      .reduce((sum, f) => sum + f.total, 0),
    averageOrderValue: delivered ? Math.round(deliveredValue / delivered) : 0,
    failedRate: outcomes.length ? failed / outcomes.length : 0,
    activeNow: active.length,
    cashToCollect: cash.reduce((sum, f) => sum + f.total, 0),
    cashToCollectOrders: cash.length,
    customers: customers.size,
    byStatus,
    byPayment,
    daily: [...dailyMap.values()],
    topStations: [...stations.values()]
      .sort((a, b) => b.deliveredValue - a.deliveredValue || b.orders - a.orders)
      .slice(0, 5),
  };
}

function toFact(row: {
  id: string;
  businessId: string;
  businessName: string | null;
  customerUserId: string | null;
  customerPhone: string | null;
  status: string;
  payment: string | null;
  paymentState: string | null;
  total: string | null;
  placedAt: Date;
}): OrderFact {
  return {
    id: row.id,
    businessId: row.businessId,
    businessName: row.businessName ?? "Unknown station",
    customerKey: row.customerUserId ?? row.customerPhone,
    status: row.status as OrderStatus,
    payment: (row.payment ?? "cod") as PaymentMethod,
    paymentState: (row.paymentState ?? "pending") as PaymentState,
    total: Number(row.total) || 0,
    placedAt: row.placedAt,
  };
}

const orderFactColumns = {
  id: orders.id,
  businessId: orders.businessId,
  businessName: sql<string | null>`${orders.data}->>'businessName'`,
  customerUserId: orders.customerUserId,
  customerPhone: orders.customerPhone,
  status: orders.status,
  payment: sql<string | null>`${orders.data}->>'payment'`,
  paymentState: sql<string | null>`${orders.data}->>'paymentState'`,
  total: sql<string | null>`${orders.data}->>'total'`,
  placedAt: orders.placedAt,
};

/** Orders placed since `since`, plus every order still in progress. */
async function loadOrderFacts(since: Date): Promise<OrderFact[]> {
  const { db } = await getDatabase();
  const rows = await db
    .select(orderFactColumns)
    .from(orders)
    .where(
      or(
        gte(orders.placedAt, since),
        sql`${orders.status} not in ('delivered', 'rejected', 'cancelled')`
      )
    );
  return rows.map(toFact);
}

/* ---------------------------------------------------------------- stations */

/**
 * Where a station stands. "hidden" means the owner published it but
 * customers cannot see it - an expired subscription, no products, no hours.
 */
export function stationState(input: {
  suspendedAt: Date | null;
  isPublished: boolean;
  isComplete: boolean;
  applicationApproved: boolean;
  subscriptionEligible: boolean;
  storefrontMissing: string[];
}): StationState {
  if (input.suspendedAt) return "suspended";
  if (input.isPublished) {
    return input.isComplete && input.applicationApproved && input.subscriptionEligible && !input.storefrontMissing.length
      ? "live"
      : "hidden";
  }
  return input.isComplete ? "ready" : "setup";
}

export interface AdminStation {
  id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  phone: string;
  state: StationState;
  /** Why a published station is not visible, in plain words. */
  issues: string[];
  /** Empty when the station has no subscription yet. */
  plan: string;
  subscriptionStatus: string;
  paid: boolean;
  monthlyFee: number;
  products: number;
  visibleProducts: number;
  orders30d: number;
  deliveredValue30d: number;
  ordersAllTime: number;
  lastOrderAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

const ISSUE_TEXT: Record<string, string> = {
  openingHours: "No opening hours",
  products: "No visible products",
};

export async function listAdminStations(now = new Date()): Promise<AdminStation[]> {
  const { db } = await getDatabase();
  const rows = await db
    .select({
      business: businesses,
      application: businessApplications,
      subscription: subscriptions,
      owner: { name: users.name, email: users.email, phone: users.phone },
    })
    .from(businesses)
    .innerJoin(businessApplications, eq(businesses.applicationId, businessApplications.id))
    .innerJoin(users, eq(businesses.ownerUserId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .orderBy(desc(businesses.createdAt));
  if (!rows.length) return [];

  const ids = rows.map((row) => row.business.id);
  const productCounts = await db
    .select({
      businessId: businessProducts.businessId,
      total: count(),
      visible: sql<number>`count(*) filter (where ${businessProducts.isVisible})`.mapWith(Number),
    })
    .from(businessProducts)
    .where(inArray(businessProducts.businessId, ids))
    .groupBy(businessProducts.businessId);
  const products = new Map(productCounts.map((p) => [p.businessId, p]));

  const since = rangeStart(now, 30);
  const orderStats = await db
    .select({
      businessId: orders.businessId,
      total: count(),
      recent: sql<number>`count(*) filter (where ${orders.placedAt} >= ${since})`.mapWith(Number),
      recentValue: sql<number>`coalesce(sum((${orders.data}->>'total')::numeric) filter (where ${orders.placedAt} >= ${since} and ${orders.status} = 'delivered'), 0)`.mapWith(Number),
      last: sql<Date | null>`max(${orders.placedAt})`,
    })
    .from(orders)
    .where(inArray(orders.businessId, ids))
    .groupBy(orders.businessId);
  const stats = new Map(orderStats.map((s) => [s.businessId, s]));

  return rows.map(({ business, application, subscription, owner }) => {
    const productCount = products.get(business.id);
    const visibleProducts = productCount?.visible ?? 0;
    const missing = storefrontMissingFields({
      openingHours: parseWeeklyHours(business.openingHours),
      visibleProductCount: visibleProducts,
    });
    const eligibility = evaluateSubscriptionEligibility(subscription as SubscriptionRecord, now);
    const approved = application.status === "approved";
    const state = stationState({
      suspendedAt: business.suspendedAt,
      isPublished: business.isPublished,
      isComplete: business.isComplete,
      applicationApproved: approved,
      subscriptionEligible: eligibility.eligible,
      storefrontMissing: missing,
    });
    const issues = [
      ...missing.map((field) => ISSUE_TEXT[field] ?? field),
      ...(eligibility.eligible ? [] : [(eligibility.reason ?? "Subscription not active").replace(/\.$/, "")]),
      ...(business.isComplete ? [] : ["Listing details incomplete"]),
      ...(approved ? [] : ["Application not approved"]),
    ];
    const paid = subscription?.status === "active" && Boolean(subscription.paymentConfirmedAt);
    const plan = subscription?.plan ?? "";
    const stat = stats.get(business.id);
    const last = stat?.last ? new Date(stat.last) : null;
    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      city: application.city,
      area: application.address,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      phone: application.phone,
      state,
      issues: state === "live" || state === "suspended" ? [] : issues,
      plan,
      subscriptionStatus: subscription?.status ?? "none",
      paid,
      monthlyFee: paid ? PLAN_PRICE.get(plan) ?? 0 : 0,
      products: productCount?.total ?? 0,
      visibleProducts,
      orders30d: stat?.recent ?? 0,
      deliveredValue30d: stat?.recentValue ?? 0,
      ordersAllTime: stat?.total ?? 0,
      lastOrderAt: last ? last.toISOString() : null,
      suspensionReason: business.suspensionReason,
      createdAt: business.createdAt.toISOString(),
    };
  });
}

export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 422
  ) {
    super(message);
    this.name = "AdminActionError";
  }
}

export async function setStationSuspended(id: string, suspend: boolean, reason?: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AdminActionError("Station not found.", 404);
  const note = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  if (suspend && !note) throw new AdminActionError("Give a reason for suspending the station.", 422);
  const { db } = await getDatabase();
  const [updated] = await db
    .update(businesses)
    .set(
      suspend
        ? { suspendedAt: new Date(), suspensionReason: note, updatedAt: new Date() }
        : { suspendedAt: null, suspensionReason: null, updatedAt: new Date() }
    )
    .where(eq(businesses.id, id))
    .returning({ id: businesses.id, suspendedAt: businesses.suspendedAt });
  if (!updated) throw new AdminActionError("Station not found.", 404);
  return updated;
}

/* ------------------------------------------------------------------- users */

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: AdminUserRole;
  disabled: boolean;
  createdAt: string;
  orders: number;
  deliveredValue: number;
  lastOrderAt: string | null;
  stations: number;
}

export const USERS_PAGE_SIZE = 50;

export interface UserQuery {
  q?: string;
  role?: AdminUserRole | "all";
  page?: number;
}

export async function listAdminUsers(query: UserQuery = {}): Promise<{ users: AdminUser[]; total: number; page: number }> {
  const { db } = await getDatabase();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const needle = query.q?.trim().slice(0, 80);
  const filters = [
    query.role && query.role !== "all" ? eq(users.role, query.role) : undefined,
    needle
      ? or(
          ilike(users.name, `%${needle}%`),
          ilike(users.email, `%${needle}%`),
          ilike(users.phone, `%${needle.replace(/\s+/g, "").replace(/^\+?254/, "0")}%`)
        )
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);

  return { users: await withActivity(rows), total, page };
}

async function withActivity(
  rows: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: AdminUserRole;
    disabledAt: Date | null;
    createdAt: Date;
  }[]
): Promise<AdminUser[]> {
  if (!rows.length) return [];
  const { db } = await getDatabase();
  const ids = rows.map((row) => row.id);
  const orderStats = await db
    .select({
      userId: orders.customerUserId,
      total: count(),
      value: sql<number>`coalesce(sum((${orders.data}->>'total')::numeric) filter (where ${orders.status} = 'delivered'), 0)`.mapWith(Number),
      last: sql<Date | null>`max(${orders.placedAt})`,
    })
    .from(orders)
    .where(inArray(orders.customerUserId, ids))
    .groupBy(orders.customerUserId);
  const stats = new Map(orderStats.map((s) => [s.userId, s]));
  const stationCounts = await db
    .select({ ownerUserId: businesses.ownerUserId, total: count() })
    .from(businesses)
    .where(inArray(businesses.ownerUserId, ids))
    .groupBy(businesses.ownerUserId);
  const owned = new Map(stationCounts.map((s) => [s.ownerUserId, s.total]));

  return rows.map((row) => {
    const stat = stats.get(row.id);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      disabled: Boolean(row.disabledAt),
      createdAt: row.createdAt.toISOString(),
      orders: stat?.total ?? 0,
      deliveredValue: stat?.value ?? 0,
      lastOrderAt: stat?.last ? new Date(stat.last).toISOString() : null,
      stations: owned.get(row.id) ?? 0,
    };
  });
}

export interface AdminUserDetail extends AdminUser {
  recentOrders: {
    id: string;
    orderNumber: string;
    businessName: string;
    status: OrderStatus;
    payment: PaymentMethod;
    total: number;
    placedAt: string;
  }[];
  ownedStations: { id: string; name: string; slug: string }[];
}

export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { db } = await getDatabase();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row) return null;
  const [user] = await withActivity([row]);

  const recent = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      businessName: sql<string | null>`${orders.data}->>'businessName'`,
      status: orders.status,
      payment: sql<string | null>`${orders.data}->>'payment'`,
      total: sql<string | null>`${orders.data}->>'total'`,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(eq(orders.customerUserId, id))
    .orderBy(desc(orders.placedAt))
    .limit(20);
  const owned = await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.ownerUserId, id));

  return {
    ...user,
    recentOrders: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      businessName: o.businessName ?? "Unknown station",
      status: o.status as OrderStatus,
      payment: (o.payment ?? "cod") as PaymentMethod,
      total: Number(o.total) || 0,
      placedAt: o.placedAt.toISOString(),
    })),
    ownedStations: owned,
  };
}

/**
 * Block or restore an account. Operations accounts cannot be disabled from
 * the console (that would let one operator lock out the others); change those
 * in the database. Disabling also ends every session the account holds.
 */
export async function setUserDisabled(id: string, disable: boolean, actingUserId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AdminActionError("Account not found.", 404);
  if (id === actingUserId) throw new AdminActionError("You cannot disable your own account.", 409);
  const { db } = await getDatabase();
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new AdminActionError("Account not found.", 404);
  if (target.role === "operations") {
    throw new AdminActionError("Operations accounts are managed in the database, not here.", 409);
  }
  await db
    .update(users)
    .set({ disabledAt: disable ? new Date() : null, updatedAt: new Date() })
    .where(eq(users.id, id));
  if (disable) await db.delete(sessions).where(eq(sessions.userId, id));
  return { id, disabled: disable };
}

/* ---------------------------------------------------------------- overview */

export interface PlatformInsights {
  generatedAt: string;
  summary: OrderSummary;
  stations: Record<StationState, number> & { total: number };
  pendingApplications: number;
  monthlyRecurringRevenue: number;
  paidStations: number;
  users: { customers: number; owners: number; newCustomers: number; previousNewCustomers: number };
}

export async function getPlatformInsights(days: InsightRange, now = new Date()): Promise<PlatformInsights> {
  const start = rangeStart(now, days);
  const previousStart = new Date(start.getTime() - days * DAY_MS);
  const { db } = await getDatabase();

  const [facts, stations, [applications], userRows] = await Promise.all([
    loadOrderFacts(previousStart),
    listAdminStations(now),
    db
      .select({ total: count() })
      .from(businessApplications)
      .where(inArray(businessApplications.status, ["submitted", "under_review"])),
    db
      .select({
        role: users.role,
        total: count(),
        recent: sql<number>`count(*) filter (where ${users.createdAt} >= ${start})`.mapWith(Number),
        previous: sql<number>`count(*) filter (where ${users.createdAt} >= ${previousStart} and ${users.createdAt} < ${start})`.mapWith(Number),
      })
      .from(users)
      .where(isNull(users.disabledAt))
      .groupBy(users.role),
  ]);

  const byState = { live: 0, ready: 0, setup: 0, hidden: 0, suspended: 0 } as Record<StationState, number>;
  for (const station of stations) byState[station.state] += 1;
  const customers = userRows.find((r) => r.role === "customer");
  const owners = userRows.find((r) => r.role === "business_owner");
  const paying = stations.filter((s) => s.paid && s.state !== "suspended");

  return {
    generatedAt: now.toISOString(),
    summary: summarizeOrders(facts, days, now),
    stations: { ...byState, total: stations.length },
    pendingApplications: applications?.total ?? 0,
    monthlyRecurringRevenue: paying.reduce((sum, s) => sum + s.monthlyFee, 0),
    paidStations: paying.length,
    users: {
      customers: customers?.total ?? 0,
      owners: owners?.total ?? 0,
      newCustomers: customers?.recent ?? 0,
      previousNewCustomers: customers?.previous ?? 0,
    },
  };
}
