import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, OrderLocation, OrderStatus } from "@/lib/types";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";
import { computeCartTotals } from "@/lib/pricing";
import { businesses } from "@/lib/data/businesses";

/**
 * File-backed order store.
 *
 * Orders live in `.data/orders.json` (gitignored) so the whole flow -
 * customer checkout → vendor dashboard → live tracking → platform admin -
 * works across tabs and devices without an external database. Every read
 * and write is serialized through a single queue.
 */

/**
 * Where orders are stored. `MF_DATA_DIR` lets the test suite and any other
 * process point the store at a throwaway directory instead of the repo's
 * `.data`, so a run never reads or overwrites real orders.
 */
function dataDir(): string {
  return process.env.MF_DATA_DIR
    ? path.resolve(process.env.MF_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function ordersFile(): string {
  return path.join(dataDir(), "orders.json");
}

const LOCATION_HISTORY_CAP = 300;

let queue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Record<string, Order>> {
  try {
    const raw = await fs.readFile(ordersFile(), "utf8");
    return JSON.parse(raw) as Record<string, Order>;
  } catch {
    return {};
  }
}

async function persist(orders: Record<string, Order>) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(ordersFile(), JSON.stringify(orders, null, 2), "utf8");
}

/** Serialize a read-modify-write cycle against the order file. */
function mutate<T>(fn: (orders: Record<string, Order>) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const orders = await readAll();
    const result = await fn(orders);
    await persist(orders);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function readOnly<T>(fn: (orders: Record<string, Order>) => T | Promise<T>): Promise<T> {
  const run = () => readAll().then(fn);
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function clone(order: Order): Order {
  return JSON.parse(JSON.stringify(order)) as Order;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function generateOrderNumber() {
  return `MF-${Math.floor(10000 + Math.random() * 89999)}`;
}

const MAX_LEN = { name: 80, phone: 20, estate: 60, building: 60, floor: 60, city: 40, notes: 500, landmark: 500 };

function cleanName(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const name = v.trim().replace(/\s+/g, " ").slice(0, MAX_LEN.name);
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(name) || name.length < 2) return null;
  return name;
}

/** Normalize a Kenyan phone (+254…, 0…, 07…, bare 7…) to a canonical form. */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/[\s()\-.]/g, "");
  let local = digits;
  if (local.startsWith("+254")) local = "0" + local.slice(4);
  else if (local.startsWith("254")) local = "0" + local.slice(3);
  if (!/^0\d{9}$/.test(local)) return null;
  return local;
}

interface ValidationResult {
  order?: Order;
  errors?: Record<string, string>;
}

/**
 * Validate an untrusted create payload with field-level messages. Returns the
 * normalized order or a map of human-readable per-field errors.
 */
export function validateOrder(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { errors: { _form: "Missing order payload." } };
  }
  const o = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const customerName = cleanName(o.customerName);
  if (!customerName) errors.customerName = "Enter your full name (letters only).";

  const customerPhone = normalizePhone(o.customerPhone);
  if (!customerPhone) errors.customerPhone = "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….";

  if (typeof o.businessId !== "string" || !o.businessId.trim())
    errors.businessId = "Station is missing - go back and add items again.";
  if (typeof o.businessName !== "string" || !o.businessName.trim())
    errors.businessName = "Station name is required.";

  const business = typeof o.businessId === "string"
    ? businesses.find((candidate) => candidate.id === o.businessId)
    : undefined;
  if (typeof o.businessId === "string" && o.businessId.trim() && !business) {
    errors.businessId = "This station is no longer available.";
  } else if (business) {
    const blocked = getBusinessOrderBlockReason(business);
    if (blocked) errors.businessId = blocked;
  }

  if (o.payment !== "mpesa" && o.payment !== "card")
    errors.payment = "Choose M-Pesa or card.";
  // Payment is verified server-side through /api/payments. An order is always
  // born `pending`; clients must never declare it paid.
  if (o.paymentState !== "pending")
    errors.paymentState = "Payment is confirmed server-side after checkout - please pay to complete this order.";
  // Orders always start life pending; later states move through PATCH/vendor flow.
  if (o.status !== "pending") errors.status = "New orders must start as pending.";
  if (typeof o.placedAt !== "string" || Number.isNaN(Date.parse(o.placedAt)))
    errors.placedAt = "Invalid order time.";

  // Items - verified against the authoritative station catalog, never trusted.
  if (!Array.isArray(o.items) || o.items.length === 0) {
    errors.items = "Add at least one item to your order.";
  }
  const items: Order["items"] = [];
  const catalogById = new Map((business?.products ?? []).map((p) => [p.id, p]));
  if (Array.isArray(o.items) && o.items.length > 0) {
    for (const raw of o.items) {
      if (typeof raw !== "object" || raw === null) {
        errors.items = "One of the items is malformed.";
        break;
      }
      const item = raw as Record<string, unknown>;
      if (typeof item.productId !== "string" || !item.productId.trim()) {
        errors.items = "Each item needs a product id.";
        break;
      }
      const catalog = catalogById.get(item.productId);
      if (!business || !catalog) {
        errors.items = "An item is no longer available from this station - refresh your cart.";
        break;
      }
      if (!isFiniteNumber(item.quantity) || item.quantity <= 0 || item.quantity > 1000) {
        errors.items = "Quantities must be between 1 and 1000.";
        break;
      }
      const quantity = Math.round(item.quantity);
      if (quantity > catalog.stock) {
        errors.items =
          catalog.stock <= 0
            ? `${catalog.name} is out of stock right now.`
            : `Only ${catalog.stock} × ${catalog.name} left - lower the quantity.`;
        break;
      }
      // The client echoes a price for display, but the catalog decides.
      if (!isFiniteNumber(item.unitPrice) || Math.abs(item.unitPrice - catalog.price) > 0.001) {
        errors.items = `The price of ${catalog.name} changed - refresh your cart to continue.`;
        break;
      }
      items.push({ productId: catalog.id, name: catalog.name, quantity, unitPrice: catalog.price });
    }
  }

  // Financial integrity - totals are recomputed from catalog prices and the
  // station's own fee rule, then the client echo must match. This keeps stale
  // carts, fee tampering, and cross-station mixing out.
  const authoritative = business
    ? computeCartTotals(
        items.map((line) => ({ businessId: business.id, quantity: line.quantity, unitPrice: line.unitPrice })),
        [{ id: business.id, deliveryFee: business.deliveryFee, freeDeliveryAbove: business.freeDeliveryAbove }]
      )
    : null;
  const subtotal = authoritative?.subtotal ?? 0;
  const fee = authoritative?.deliveryFee ?? 0;
  const total = authoritative?.total ?? 0;
  if (!authoritative || !isFiniteNumber(o.subtotal) || Math.abs(o.subtotal - subtotal) > 0.001)
    errors.subtotal = "Subtotal doesn't match the current catalog - refresh and retry.";
  if (!isFiniteNumber(o.deliveryFee) || Math.abs((o.deliveryFee as number) - fee) > 0.001)
    errors.deliveryFee = "Delivery fee is set by the station - refresh and retry.";
  if (!isFiniteNumber(o.total) || Math.abs(o.total - total) > 0.001)
    errors.total = "Total doesn't match - refresh and retry.";

  // Address
  if (typeof o.address !== "object" || o.address === null) {
    errors.address = "Delivery address is required.";
  }
  let address: Order["address"] | undefined;
  if (typeof o.address === "object" && o.address !== null) {
    const a = o.address as Record<string, unknown>;
    const estate = typeof a.estate === "string" ? a.estate.trim() : "";
    const phone = normalizePhone(a.phone);
    if (!estate) errors.estate = "Choose a recognised estate - riders use these to navigate.";
    if (!phone) errors.phone = "Enter the phone the rider should call.";
    if (estate.length > MAX_LEN.estate) errors.estate = "That estate name is too long.";
    address = {
      label: typeof a.label === "string" && a.label.trim() ? a.label.slice(0, 40) : "Delivery",
      estate,
      street: typeof a.street === "string" ? a.street.slice(0, MAX_LEN.estate) : undefined,
      city:
        typeof a.city === "string" && a.city.trim()
          ? a.city.trim().slice(0, MAX_LEN.city)
          : undefined,
      landmark:
        typeof a.landmark === "string" && a.landmark.trim()
          ? a.landmark.trim().slice(0, MAX_LEN.landmark)
          : undefined,
      building:
        typeof a.building === "string" && a.building.trim()
          ? a.building.trim().slice(0, MAX_LEN.building)
          : undefined,
      floor:
        typeof a.floor === "string" && a.floor.trim() ? a.floor.trim().slice(0, MAX_LEN.floor) : undefined,
      notes:
        typeof a.notes === "string" && a.notes.trim()
          ? a.notes.trim().slice(0, MAX_LEN.notes)
          : undefined,
      phone: phone ?? "",
      lat: isFiniteNumber(a.lat) && a.lat >= -90 && a.lat <= 90 ? a.lat : undefined,
      lng: isFiniteNumber(a.lng) && a.lng >= -180 && a.lng <= 180 ? a.lng : undefined,
      accuracy: isFiniteNumber(a.accuracy) && a.accuracy >= 0 ? a.accuracy : undefined,
      locationAt:
        typeof a.locationAt === "string" && !Number.isNaN(Date.parse(a.locationAt))
          ? a.locationAt
          : undefined,
    };
  }

  if (Object.keys(errors).length > 0) return { errors };

  const verifiedAt = new Date().toISOString();
  const order: Order = {
    id: typeof o.id === "string" && o.id.trim() ? o.id.slice(0, 80) : `order-${Date.now()}`,
    orderNumber:
      typeof o.orderNumber === "string" && o.orderNumber.trim()
        ? o.orderNumber
        : generateOrderNumber(),
    businessId: o.businessId as string,
    businessName: business!.name,
    customerName: customerName!,
    customerPhone: customerPhone!,
    items,
    subtotal,
    deliveryFee: fee,
    total,
    pricingSnapshot: {
      verifiedAt,
      items: items.map((line) => ({ ...line })),
      subtotal,
      deliveryFee: fee,
      total,
    },
    payment: o.payment as Order["payment"],
    paymentState: "pending",
    status: "pending",
    address: address!,
    placedAt: o.placedAt as string,
    eta: typeof o.eta === "string" ? o.eta : undefined,
    timeline: [{ status: o.status as OrderStatus, at: o.placedAt as string }],
    location: null,
    locationHistory: [],
  };
  return { order };
}

export interface ListOptions {
  businessId?: string;
  status?: string;
  phone?: string;
  /** Restrict to orders owned by this customer account. */
  customerUserId?: string;
}

export async function listOrders(opts: ListOptions = {}): Promise<Order[]> {
  return readOnly((orders) => {
    let list = Object.values(orders);
    if (opts.customerUserId) list = list.filter((o) => o.customerUserId === opts.customerUserId);
    if (opts.businessId) list = list.filter((o) => o.businessId === opts.businessId);
    if (opts.status) list = list.filter((o) => o.status === opts.status);
    if (opts.phone) {
      const needleRaw = opts.phone.replace(/\s+/g, "");
      const needleNorm = normalizePhone(opts.phone);
      list = list.filter((o) => {
        const storedRaw = o.customerPhone.replace(/\s+/g, "");
        const storedNorm = normalizePhone(o.customerPhone);
        return (
          storedRaw.includes(needleRaw) ||
          (storedNorm !== null && needleNorm !== null && storedNorm === needleNorm)
        );
      });
    }
    return list
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .map(clone);
  });
}

export async function getOrder(id: string): Promise<Order | null> {
  return readOnly((orders) => (orders[id] ? clone(orders[id]) : null));
}

/** Ownership-checked read: another customer's order is indistinguishable from a missing one. */
/** Order as exposed by the public (unauthenticated) order endpoints - without the owning account id. */
export function publicOrder(order: Order): Order {
  const copy = { ...order };
  delete copy.customerUserId;
  return copy;
}

export async function getCustomerOrder(id: string, customerUserId: string): Promise<Order | null> {
  const order = await getOrder(id);
  return order && order.customerUserId === customerUserId ? order : null;
}

/**
 * Unlink a deleted account from its orders. The orders stay - stations need
 * them for their records - but they no longer point at a user.
 */
export async function detachCustomerOrders(customerUserId: string): Promise<number> {
  return mutate((orders) => {
    let count = 0;
    for (const order of Object.values(orders)) {
      if (order.customerUserId === customerUserId) {
        delete order.customerUserId;
        count += 1;
      }
    }
    return count;
  });
}

/**
 * Persist a new order. Idempotent by id: submitting a duplicate id (e.g. a
 * client retry) returns the existing order unchanged instead of duplicating it.
 */
export async function createOrder(input: Order): Promise<{ order: Order; created: boolean }> {
  return mutate((orders) => {
    const existing = input.id ? orders[input.id] : undefined;
    if (existing) {
      const sameBusiness = existing.businessId === input.businessId;
      const sameItems =
        existing.items.length === input.items.length &&
        existing.items.every(
          (it, i) =>
            it.productId === input.items[i]?.productId && it.quantity === input.items[i]?.quantity
        );
      if (sameBusiness && sameItems) return { order: clone(existing), created: false };
    }
    const id = existing ? `${input.id}-${Math.random().toString(36).slice(2, 7)}` : input.id;
    const order: Order = {
      ...input,
      id,
      timeline: input.timeline?.length ? input.timeline : [{ status: input.status, at: input.placedAt }],
      location: input.location ?? null,
      locationHistory: input.locationHistory ?? [],
    };
    orders[id] = order;
    return { order: clone(order), created: true };
  });
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  return mutate((orders) => {
    const existing = orders[id];
    if (!existing) return null;
    const next: Order = { ...existing, ...patch, id: existing.id };
    if (patch.status && patch.status !== existing.status) {
      next.timeline = [...(existing.timeline ?? []), { status: patch.status, at: new Date().toISOString() }];
    } else {
      next.timeline = existing.timeline;
    }
    next.location = patch.location !== undefined ? patch.location : existing.location;
    next.locationHistory =
      patch.locationHistory !== undefined ? patch.locationHistory : existing.locationHistory;
    orders[id] = next;
    return clone(next);
  });
}

/**
 * Move an order to a new status only if `guard` still allows it, checked
 * inside the same serialized write so a concurrent station update can't slip
 * between the check and the change.
 */
export async function transitionOrder(
  id: string,
  status: OrderStatus,
  guard: (order: Order) => string | null
): Promise<{ order: Order } | { error: string } | null> {
  return mutate((orders) => {
    const existing = orders[id];
    if (!existing) return null;
    const blocked = guard(clone(existing));
    if (blocked) return { error: blocked };
    const next: Order = {
      ...existing,
      status,
      timeline: [...(existing.timeline ?? []), { status, at: new Date().toISOString() }],
    };
    orders[id] = next;
    return { order: clone(next) };
  });
}

export async function recordLocation(id: string, loc: OrderLocation): Promise<Order | null> {
  return mutate((orders) => {
    const existing = orders[id];
    if (!existing) return null;
    const history = [...(existing.locationHistory ?? []), loc].slice(-LOCATION_HISTORY_CAP);
    orders[id] = { ...existing, location: loc, locationHistory: history };
    return clone(orders[id]);
  });
}
