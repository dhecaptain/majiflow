import { BUSINESS_TIME_ZONE } from "@/lib/business-hours";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import type { Business, Order, OrderStatus, StockAlert } from "@/lib/types";

/**
 * Station-scoped analytics.
 *
 * Everything here is a pure function of the orders already stored by
 * `/api/orders`, so the station dashboard, the analytics screen and the
 * customer list all read the same numbers and no screen invents its own
 * totals. Day and month buckets are cut in the station's local calendar
 * (`Africa/Nairobi`), never in the browser's zone.
 */

const UNCOUNTED_STATUS: OrderStatus[] = ["rejected", "cancelled"];
const ACTIVE_STATUS: readonly OrderStatus[] = ACTIVE_STATUSES;

/** A customer with no order for this many days counts as dormant. */
export const DORMANT_AFTER_DAYS = 30;
/** A customer whose first order is newer than this counts as new. */
export const NEW_WITHIN_DAYS = 30;

export const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
] as const;

export type DateRangeId = (typeof DATE_RANGES)[number]["id"];
export type DateGrain = "hour" | "day" | "month";

export interface DateRange {
  id: DateRangeId;
  label: string;
  /** Inclusive lower bound (ms since epoch). */
  from: number;
  /** Inclusive upper bound (ms since epoch). */
  to: number;
  grain: DateGrain;
  /** Length of the window in ms, or null when it is open ended ("all"). */
  span: number | null;
}

export interface StationCustomer {
  /** Stable id derived from the phone number so re-derivation keeps rows. */
  id: string;
  name: string;
  phone: string;
  location: string;
  orders: number;
  totalSpent: number;
  firstOrder: string;
  lastOrder: string;
  status: "active" | "new" | "dormant";
}

export interface StationBucket {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

export interface StationProductRow {
  name: string;
  quantity: number;
  orders: number;
  revenue: number;
}

export interface StationStats {
  orderCount: number;
  revenue: number;
  deliveryRevenue: number;
  gross: number;
  avgOrderValue: number;
  statusCounts: Record<OrderStatus, number>;
  /** Live orders in any state, ignoring the selected date range. */
  activeCount: number;
  repeatRate: number;
  newCustomers: number;
  customers: StationCustomer[];
  buckets: StationBucket[];
  topProducts: StationProductRow[];
  stockAlerts: StockAlert[];
  /** Same-length window immediately before the selected one, when comparable. */
  previous: { revenue: number; orders: number } | null;
}

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/** Milliseconds between UTC and the zone at that instant. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = partsInZone(new Date(utcMs), timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - utcMs;
}

/** Epoch ms of the most recent 00:00 in `timeZone` at or before `utcMs`. */
export function startOfZonedDay(utcMs: number, timeZone = BUSINESS_TIME_ZONE): number {
  const p = partsInZone(new Date(utcMs), timeZone);
  const midnightWall = Date.UTC(p.year, p.month - 1, p.day);
  return midnightWall - zoneOffsetMs(midnightWall, timeZone);
}

/** Epoch ms of the first 00:00 of the station-local month containing `utcMs`. */
export function startOfZonedMonth(utcMs: number, timeZone = BUSINESS_TIME_ZONE): number {
  const p = partsInZone(new Date(utcMs), timeZone);
  const monthWall = Date.UTC(p.year, p.month - 1, 1);
  return monthWall - zoneOffsetMs(monthWall, timeZone);
}

/** "YYYY-MM-DD" in the station's zone, used as a day bucket key. */
export function zonedDateKey(utcMs: number, timeZone = BUSINESS_TIME_ZONE): string {
  const p = partsInZone(new Date(utcMs), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function zonedKeyForGrain(utcMs: number, grain: DateGrain, timeZone = BUSINESS_TIME_ZONE): string {
  if (grain === "hour") {
    const p = partsInZone(new Date(utcMs), timeZone);
    return `${zonedDateKey(utcMs, timeZone)}T${String(p.hour).padStart(2, "0")}`;
  }
  if (grain === "month") {
    const p = partsInZone(new Date(utcMs), timeZone);
    return `${p.year}-${String(p.month).padStart(2, "0")}`;
  }
  return zonedDateKey(utcMs, timeZone);
}

/**
 * Resolve a range preset into concrete bounds. `asOf` is injectable so
 * tests can pin "now" and assert on the resulting window.
 */
export function resolveDateRange(id: DateRangeId, asOf: Date = new Date()): DateRange {
  const now = asOf.getTime();
  const preset = DATE_RANGES.find((r) => r.id === id) ?? DATE_RANGES[1];
  const dayStart = startOfZonedDay(now);

  if (id === "today") return { id, label: preset.label, from: dayStart, to: now, grain: "hour", span: now - dayStart };
  if (id === "7d") {
    const from = startOfZonedDay(dayStart - 6 * 86_400_000);
    return { id, label: preset.label, from, to: now, grain: "day", span: now - from };
  }
  if (id === "30d") {
    const from = startOfZonedDay(dayStart - 29 * 86_400_000);
    return { id, label: preset.label, from, to: now, grain: "day", span: now - from };
  }
  if (id === "month") {
    const from = startOfZonedMonth(now);
    return { id, label: preset.label, from, to: now, grain: "day", span: now - from };
  }
  return { id: "all", label: preset.label, from: 0, to: now, grain: "month", span: null };
}

export function placedAtMs(order: Order): number {
  return new Date(order.placedAt).getTime();
}

/** Orders whose `placedAt` falls inside the range. */
export function ordersInRange(orders: Order[], range: DateRange): Order[] {
  return orders.filter((o) => {
    const t = placedAtMs(o);
    return Number.isFinite(t) && t >= range.from && t <= range.to;
  });
}

/** Rejected, cancelled and unpaid orders are not revenue. */
export function isRevenueOrder(order: Order): boolean {
  return !UNCOUNTED_STATUS.includes(order.status) && order.paymentState !== "failed";
}

/** Normalise to the canonical `07…` form so one customer is one row. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s()\-.]/g, "");
  if (digits.startsWith("+254")) return `0${digits.slice(4)}`;
  if (digits.startsWith("254")) return `0${digits.slice(3)}`;
  return digits;
}

function bucketLabel(key: string, grain: DateGrain): string {
  if (grain === "hour") {
    const hour = Number(key.slice(11, 13));
    return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;
  }
  if (grain === "month") {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
  }
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-KE", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

/** Bucket keys covering the range, in order, skipping buckets with no orders. */
function buildBuckets(orders: Order[], range: DateRange): StationBucket[] {
  if (orders.length === 0) return [];
  const totals = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const key = zonedKeyForGrain(placedAtMs(order), range.grain);
    const current = totals.get(key) ?? { revenue: 0, orders: 0 };
    if (isRevenueOrder(order)) current.revenue += order.subtotal;
    current.orders += 1;
    totals.set(key, current);
  }

  const keys = [...totals.keys()].sort();
  const filled: StationBucket[] = [];
  // Leading buckets are dropped so the chart never starts with a long empty
  // tail for "all time"; every bucket between first and last order is filled
  // in so gaps stay visible.
  const first = keys[0];
  const last = keys[keys.length - 1];
  const cursor = new Date(`${grainStartKey(first, range.grain)}T00:00:00Z`);
  const end = new Date(`${grainStartKey(last, range.grain)}T00:00:00Z`);

  while (cursor <= end) {
    const key = cursorKey(cursor, range.grain);
    const total = totals.get(key);
    filled.push({ key, label: bucketLabel(key, range.grain), revenue: total?.revenue ?? 0, orders: total?.orders ?? 0 });
    stepCursor(cursor, range.grain);
  }
  return filled;
}

function grainStartKey(key: string, grain: DateGrain): string {
  if (grain === "hour") return key.slice(0, 10);
  if (grain === "month") return `${key}-01`;
  return key;
}

function cursorKey(cursor: Date, grain: DateGrain): string {
  const iso = cursor.toISOString();
  if (grain === "hour") return `${iso.slice(0, 10)}T${iso.slice(11, 13)}`;
  if (grain === "month") return iso.slice(0, 7);
  return iso.slice(0, 10);
}

function stepCursor(cursor: Date, grain: DateGrain) {
  if (grain === "hour") cursor.setUTCHours(cursor.getUTCHours() + 1);
  else if (grain === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  else cursor.setUTCDate(cursor.getUTCDate() + 1);
}

function deriveCustomers(orders: Order[], now: Date): StationCustomer[] {
  const rows = new Map<string, StationCustomer>();

  for (const order of orders) {
    const phone = normalizePhone(order.customerPhone) || order.id;
    const existing = rows.get(phone) ?? {
      id: `c-${phone}`,
      name: order.customerName,
      phone,
      location: [order.address.estate, order.address.city].filter(Boolean).join(", "),
      orders: 0,
      totalSpent: 0,
      firstOrder: order.placedAt,
      lastOrder: order.placedAt,
      status: "active" as const,
    };
    existing.orders += 1;
    if (isRevenueOrder(order)) existing.totalSpent += order.total;
    if (order.placedAt < existing.firstOrder) existing.firstOrder = order.placedAt;
    if (order.placedAt > existing.lastOrder) existing.lastOrder = order.placedAt;
    rows.set(phone, existing);
  }

  const nowMs = now.getTime();
  return [...rows.values()]
    .map((customer) => {
      const daysSinceLast = (nowMs - new Date(customer.lastOrder).getTime()) / 86_400_000;
      const daysSinceFirst = (nowMs - new Date(customer.firstOrder).getTime()) / 86_400_000;
      const status: StationCustomer["status"] =
        daysSinceLast > DORMANT_AFTER_DAYS ? "dormant" : daysSinceFirst <= NEW_WITHIN_DAYS ? "new" : "active";
      return { ...customer, status };
    })
    .sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
}

/** Stock rows at or below their reorder point, derived from the station record. */
export function stockAlertsFor(business: Business): StockAlert[] {
  return business.products
    .filter((p) => p.stock <= p.stockLow)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      threshold: p.stockLow,
      unit: p.unit,
    }));
}

/**
 * Window immediately before the selected one. "Today" compares against the
 * whole of yesterday; bounded windows shift back by their own length. Open
 * ended ranges have nothing to compare against.
 */
function previousWindow(range: DateRange): { from: number; to: number } | null {
  if (range.id === "today") {
    return { from: startOfZonedDay(range.to - 86_400_000), to: range.from };
  }
  if (range.span === null) return null;
  return { from: range.from - range.span, to: range.from };
}

function topProductsFor(orders: Order[]): StationProductRow[] {
  const rows = new Map<string, StationProductRow>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = rows.get(item.name) ?? { name: item.name, quantity: 0, orders: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.orders += 1;
      existing.revenue += item.quantity * item.unitPrice;
      rows.set(item.name, existing);
    }
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
}

/**
 * Aggregate every number a station screen shows. `allOrders` is the station's
 * complete history (so repeat rate and live counts are not clipped by the
 * selected range) while the range decides what is counted as "in range".
 */
export function summarizeStation(
  business: Business,
  allOrders: Order[],
  range: DateRange,
  now: Date = new Date()
): StationStats {
  const inRange = ordersInRange(allOrders, range);

  const statusCounts: Record<OrderStatus, number> = {
    pending: 0,
    accepted: 0,
    preparing: 0,
    rider_assigned: 0,
    out_for_delivery: 0,
    delivered: 0,
    rejected: 0,
    cancelled: 0,
  };
  for (const order of allOrders) statusCounts[order.status] += 1;

  const revenueOrders = inRange.filter(isRevenueOrder);
  const revenue = revenueOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const deliveryRevenue = revenueOrders.reduce((sum, o) => sum + o.deliveryFee, 0);

  const customers = deriveCustomers(allOrders, now);
  // Match by the canonical phone so "+254…" and "07…" spellings collapse.
  const phonesInRange = new Set(inRange.filter(isRevenueOrder).map((o) => normalizePhone(o.customerPhone)));
  const orderingInRange = customers.filter((c) => phonesInRange.has(c.phone));
  const repeatInRange = orderingInRange.filter((c) => c.orders > 1).length;

  const window = previousWindow(range);
  const previous = window
    ? {
        revenue: ordersInRange(allOrders, { ...range, from: window.from, to: window.to }).reduce(
          (sum, o) => (isRevenueOrder(o) ? sum + o.subtotal : sum),
          0
        ),
        orders: ordersInRange(allOrders, { ...range, from: window.from, to: window.to }).length,
      }
    : null;

  return {
    orderCount: inRange.length,
    revenue,
    deliveryRevenue,
    gross: revenue + deliveryRevenue,
    avgOrderValue: revenueOrders.length ? Math.round(revenue / revenueOrders.length) : 0,
    statusCounts,
    activeCount: allOrders.filter((o) => ACTIVE_STATUS.includes(o.status)).length,
    repeatRate: orderingInRange.length ? Math.round((repeatInRange / orderingInRange.length) * 100) : 0,
    newCustomers: customers.filter((c) => new Date(c.firstOrder).getTime() >= range.from).length,
    customers,
    buckets: buildBuckets(inRange, range),
    topProducts: topProductsFor(revenueOrders),
    stockAlerts: stockAlertsFor(business),
    previous,
  };
}

/** Percent change between two totals, or null when there is no baseline. */
export function percentChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

/** Search + segment filter shared by the customers screen. */
export function filterCustomers(
  customers: StationCustomer[],
  { query = "", segment = "all" }: { query?: string; segment?: StationCustomer["status"] | "all" }
): StationCustomer[] {
  const needle = query.trim().toLowerCase();
  return customers.filter((c) => {
    if (segment !== "all" && c.status !== segment) return false;
    if (!needle) return true;
    return (
      c.name.toLowerCase().includes(needle) ||
      c.phone.includes(needle.replace(/\s+/g, "")) ||
      c.location.toLowerCase().includes(needle)
    );
  });
}
