import { randomBytes, randomUUID } from "node:crypto";
import type {
  FulfillmentActor,
  FulfillmentMethod,
  Order,
  OrderConsent,
  OrderLocation,
  OrderStatus,
} from "@/lib/types";
import { isActiveStatus, isTerminalStatus, TERMINAL_STATUSES } from "@/lib/order-status";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";
import { computeCartTotals } from "@/lib/pricing";
import { businesses } from "@/lib/data/businesses";
import { normalizeKenyanPhone } from "@/lib/phone";
import { documentStore } from "@/lib/server/doc-store";
import { orders as ordersTable } from "@/lib/server/db/schema";

/**
 * Order store.
 *
 * Orders are documents in the Postgres `orders` table (a local JSON file in
 * development and tests - see doc-store.ts). Every change to one order is an
 * atomic, row-locked read-modify-write, so concurrent station, rider and
 * payment updates cannot overwrite each other.
 */

const store = documentStore<Order>({
  name: "orders",
  table: ordersTable,
  id: (order) => order.id,
  columns: (order) => ({
    idempotencyKey: order.idempotencyKey ?? null,
    orderNumber: order.orderNumber,
    businessId: order.businessId,
    customerUserId: order.customerUserId ?? null,
    customerPhone: normalizeKenyanPhone(order.customerPhone) ?? order.customerPhone,
    status: order.status,
    riderTokenHash: order.riderTokenHash ?? null,
    placedAt: new Date(order.placedAt),
  }),
  fields: {
    idempotencyKey: { column: ordersTable.idempotencyKey, read: (o) => o.idempotencyKey },
    orderNumber: { column: ordersTable.orderNumber, read: (o) => o.orderNumber },
    businessId: { column: ordersTable.businessId, read: (o) => o.businessId },
    customerUserId: { column: ordersTable.customerUserId, read: (o) => o.customerUserId },
    customerPhone: {
      column: ordersTable.customerPhone,
      read: (o) => normalizeKenyanPhone(o.customerPhone) ?? o.customerPhone,
    },
    status: { column: ordersTable.status, read: (o) => o.status },
    riderTokenHash: { column: ordersTable.riderTokenHash, read: (o) => o.riderTokenHash },
  },
  unique: ["idempotencyKey", "orderNumber"],
});

const LOCATION_HISTORY_CAP = 300;

function clone(order: Order): Order {
  return JSON.parse(JSON.stringify(order)) as Order;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Customer-facing reference, e.g. MF-7K3Q9X. Letters that read alike (0/O, 1/I) are left out. */
const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateOrderNumber() {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) suffix += ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length];
  return `MF-${suffix}`;
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
  return normalizeKenyanPhone(v);
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

  // Delivery or collection. A collected order is collected at the station, so
  // it is never charged a delivery fee.
  let fulfilment: FulfillmentMethod = "delivery";
  if (o.fulfilment !== undefined && o.fulfilment !== null) {
    if (o.fulfilment === "delivery" || o.fulfilment === "pickup") {
      fulfilment = o.fulfilment;
    } else {
      errors.fulfilment = "Choose delivery or pickup.";
    }
  }

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
      // The option is part of the product: the catalog decides the price, the
      // deposit and how many of that choice are in stock. A request that names
      // no option is priced as the plain product, so an older cart still works.
      const optionId = typeof item.optionId === "string" ? item.optionId.trim() : "";
      const option = optionId
        ? catalog.options?.find((candidate) => candidate.id === optionId)
        : undefined;
      if (optionId && !option) {
        errors.items = `That choice for ${catalog.name} is no longer available - refresh your cart.`;
        break;
      }
      const optionStock = option?.stock ?? catalog.stock;
      if (quantity > optionStock) {
        errors.items =
          optionStock <= 0
            ? option
              ? `That choice of ${catalog.name} is out of stock right now.`
              : `${catalog.name} is out of stock right now.`
            : `Only ${optionStock} × ${catalog.name} left - lower the quantity.`;
        break;
      }
      // The client echoes a price for display, but the catalog decides.
      const unitPrice = catalog.price + (option?.priceDelta ?? 0);
      if (!isFiniteNumber(item.unitPrice) || Math.abs(item.unitPrice - unitPrice) > 0.001) {
        errors.items = `The price of ${catalog.name} changed - refresh your cart to continue.`;
        break;
      }
      const deposit = option?.deposit ?? 0;
      items.push({
        productId: catalog.id,
        name: catalog.name,
        quantity,
        unitPrice,
        ...(option ? { optionId: option.id, optionLabel: option.label, deposit } : {}),
      });
    }
  }

  // Financial integrity - totals are recomputed from catalog prices and the
  // station's own fee rule, then the client echo must match. This keeps stale
  // carts, fee tampering, and cross-station mixing out.
  const authoritative = business
    ? computeCartTotals(
        items.map((line) => ({
          businessId: business.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          deposit: line.deposit,
        })),
        [
          {
            id: business.id,
            // A collected order is collected at the station: no delivery fee.
            deliveryFee: fulfilment === "pickup" ? 0 : business.deliveryFee,
            freeDeliveryAbove: fulfilment === "pickup" ? 0 : business.freeDeliveryAbove,
          },
        ]
      )
    : null;
  const subtotal = authoritative?.subtotal ?? 0;
  const fee = authoritative?.deliveryFee ?? 0;
  const depositTotal = authoritative?.deposit ?? 0;
  const total = authoritative?.total ?? 0;
  if (!authoritative || !isFiniteNumber(o.subtotal) || Math.abs(o.subtotal - subtotal) > 0.001)
    errors.subtotal = "Subtotal doesn't match the current catalog - refresh and retry.";
  if (!isFiniteNumber(o.deliveryFee) || Math.abs((o.deliveryFee as number) - fee) > 0.001)
    errors.deliveryFee = "Delivery fee is set by the station - refresh and retry.";
  if (o.deposit !== undefined && (!isFiniteNumber(o.deposit) || Math.abs((o.deposit as number) - depositTotal) > 0.001))
    errors.deposit = "The refundable deposit doesn't match the catalog - refresh and retry.";
  if (!isFiniteNumber(o.total) || Math.abs(o.total - total) > 0.001)
    errors.total = "Total doesn't match - refresh and retry.";

  // Address. A collected order is collected at the station, so the station's
  // own address is used; a delivered order needs the area the customer gave
  // us - free text or a pinned spot, whichever they chose.
  let address: Order["address"] | undefined;
  if (fulfilment === "pickup") {
    if (!business) {
      errors.address = "We can't find that station to collect from.";
    } else {
      address = {
        label: "Pickup",
        estate: business.name,
        city: business.city,
        notes: `Collect from ${business.name}`,
        phone: customerPhone ?? "",
        lat: business.lat,
        lng: business.lng,
      };
    }
  } else {
    if (typeof o.address !== "object" || o.address === null) {
      errors.address = "Delivery address is required.";
    }
    if (typeof o.address === "object" && o.address !== null) {
      const a = o.address as Record<string, unknown>;
      const estate = typeof a.estate === "string" ? a.estate.trim() : "";
      const phone = normalizePhone(a.phone);
      const lat = isFiniteNumber(a.lat) && a.lat >= -90 && a.lat <= 90 ? a.lat : undefined;
      const lng = isFiniteNumber(a.lng) && a.lng >= -180 && a.lng <= 180 ? a.lng : undefined;
      const pinned = lat !== undefined && lng !== undefined;
      if (!estate && !pinned)
        errors.estate = "Tell us your area or drop a pin so the rider can find you.";
      if (!phone) errors.phone = "Enter the phone the rider should call.";
      if (estate.length > MAX_LEN.estate) errors.estate = "That area name is too long.";
      address = {
        label: typeof a.label === "string" && a.label.trim() ? a.label.slice(0, 40) : "Delivery",
        estate: estate || (pinned ? "Pinned location" : ""),
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
        lat,
        lng,
        accuracy: isFiniteNumber(a.accuracy) && a.accuracy >= 0 ? a.accuracy : undefined,
        locationAt:
          typeof a.locationAt === "string" && !Number.isNaN(Date.parse(a.locationAt))
            ? a.locationAt
            : undefined,
      };
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  const verifiedAt = new Date().toISOString();
  // The id is the private tracking link, so the server always picks it. The
  // id the client sent identifies its checkout attempt, so a retry of the
  // same attempt returns the order it already created.
  const order: Order = {
    id: randomUUID(),
    idempotencyKey: typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 160) : undefined,
    orderNumber: generateOrderNumber(),
    businessId: o.businessId as string,
    businessName: business!.name,
    customerName: customerName!,
    customerPhone: customerPhone!,
    items,
    subtotal,
    deliveryFee: fee,
    deposit: depositTotal,
    total,
    fulfilment,
    pricingSnapshot: {
      verifiedAt,
      items: items.map((line) => ({ ...line })),
      subtotal,
      deliveryFee: fee,
      deposit: depositTotal,
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
    consent: consentFrom(o.consent),
  };
  return { order };
}

/**
 * Checkout consent. Live location sharing is opt-in; transactional SMS
 * updates default on (the number was given for this delivery) and can be
 * switched off at checkout or later from the tracking page.
 */
function consentFrom(input: unknown): OrderConsent {
  const c = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return { location: c.location === true, smsUpdates: c.smsUpdates !== false, updatedAt: new Date().toISOString() };
}

export interface ListOptions {
  businessId?: string;
  /** Restrict to any of these stations (a station account's own stations). */
  businessIds?: readonly string[];
  status?: string;
  phone?: string;
  /** Restrict to orders owned by this customer account. */
  customerUserId?: string;
}

export async function listOrders(opts: ListOptions = {}): Promise<Order[]> {
  const needleNorm = opts.phone ? normalizePhone(opts.phone) : null;
  let list = await store.find({
    businessId: opts.businessId ?? opts.businessIds,
    status: opts.status,
    customerUserId: opts.customerUserId,
    customerPhone: needleNorm ?? undefined,
  });
  if (opts.phone && !needleNorm) {
    // A partial number: match on the digits the caller typed.
    const needleRaw = opts.phone.replace(/\s+/g, "");
    list = list.filter((o) => o.customerPhone.replace(/\s+/g, "").includes(needleRaw));
  }
  return list.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export async function getOrder(id: string): Promise<Order | null> {
  return store.get(id);
}

/**
 * Order as shown to whoever holds the tracking link: no owning account id,
 * no rider access token, and no stored location trail (only stations need it).
 */
export function publicOrder(order: Order): Order {
  const copy = staffOrder(order);
  delete copy.location;
  delete copy.locationHistory;
  return copy;
}

/** Order as shown to the station that owns it and to the platform admin. */
export function staffOrder(order: Order): Order {
  const copy = { ...order };
  delete copy.customerUserId;
  delete copy.riderTokenHash;
  delete copy.idempotencyKey;
  return copy;
}

/** Ownership-checked read: another customer's order is indistinguishable from a missing one. */
export async function getCustomerOrder(id: string, customerUserId: string): Promise<Order | null> {
  const order = await getOrder(id);
  return order && order.customerUserId === customerUserId ? order : null;
}

/**
 * Unlink a deleted account from its orders. The orders stay - stations need
 * them for their records - but they no longer point at a user.
 */
export async function detachCustomerOrders(customerUserId: string): Promise<number> {
  let count = 0;
  for (const order of await store.find({ customerUserId })) {
    const detached = await store.update(order.id, (draft) => {
      if (draft.customerUserId !== customerUserId) return false;
      delete draft.customerUserId;
      return true;
    });
    if (detached) count += 1;
  }
  return count;
}

/** True when two orders are the same checkout of the same items. */
function sameCheckout(a: Order, b: Order): boolean {
  return (
    a.businessId === b.businessId &&
    a.items.length === b.items.length &&
    a.items.every((it, i) => it.productId === b.items[i]?.productId && it.quantity === b.items[i]?.quantity)
  );
}

/**
 * Persist a new order. Idempotent by checkout attempt: resubmitting the same
 * attempt (a client retry) returns the existing order instead of duplicating it.
 */
export async function createOrder(input: Order): Promise<{ order: Order; created: boolean }> {
  let idempotencyKey = input.idempotencyKey;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (idempotencyKey) {
      const [existing] = await store.find({ idempotencyKey });
      if (existing) {
        if (sameCheckout(existing, input)) return { order: existing, created: false };
        // Same attempt key, different basket: keep both, but never merge them.
        idempotencyKey = `${idempotencyKey}-${randomBytes(3).toString("hex")}`;
      }
    }
    const order: Order = {
      ...input,
      id: attempt === 0 ? input.id : randomUUID(),
      orderNumber: attempt === 0 ? input.orderNumber : generateOrderNumber(),
      idempotencyKey,
      timeline: input.timeline?.length ? input.timeline : [{ status: input.status, at: input.placedAt }],
      location: input.location ?? null,
      locationHistory: input.locationHistory ?? [],
    };
    if (await store.insert(order)) return { order, created: true };
    // Lost a race: another request took this attempt key, order number or id.
  }
  throw new Error("Could not allocate a unique order reference.");
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  return store.update(id, (draft) => {
    const previousStatus = draft.status;
    Object.assign(draft, patch, { id: draft.id });
    if (patch.status && patch.status !== previousStatus) {
      draft.timeline = [...(draft.timeline ?? []), { status: patch.status, at: new Date().toISOString() }];
    }
    return clone(draft);
  });
}

export interface TransitionOptions {
  actor?: FulfillmentActor;
  /** Customer-safe note stored on the timeline entry. */
  note?: string;
  /** Extra fields written in the same atomic write as the status change. */
  patch?: (order: Order) => Partial<Order>;
}

/**
 * Move an order to a new status only if `guard` still allows it, checked
 * inside the same locked write so a concurrent station update can't slip
 * between the check and the change. Closing an order (delivered, rejected,
 * cancelled) drops its live location trail and revokes rider access in the
 * same write - nothing location-shaped outlives the delivery.
 */
export async function transitionOrder(
  id: string,
  status: OrderStatus,
  guard: (order: Order) => string | null,
  options: TransitionOptions = {}
): Promise<{ order: Order; previous: Order } | { error: string } | null> {
  return store.update(id, (draft) => {
    const previous = clone(draft);
    const blocked = guard(clone(draft));
    if (blocked) return { error: blocked };
    const at = new Date().toISOString();
    const entry = { status, at, ...(options.actor ? { actor: options.actor } : {}), ...(options.note ? { note: options.note } : {}) };
    Object.assign(draft, options.patch ? options.patch(clone(previous)) : {}, {
      id: previous.id,
      status,
      timeline: [...(previous.timeline ?? []), entry],
    });
    if (isTerminalStatus(status)) {
      draft.location = null;
      draft.locationHistory = [];
      delete draft.riderTokenHash;
      draft.closedAt = at;
    }
    return { order: clone(draft), previous };
  });
}

/** The order a rider token was issued for, while that token is still live. */
export async function findOrderByRiderToken(tokenHash: string): Promise<Order | null> {
  if (!tokenHash) return null;
  const [match] = await store.find({ riderTokenHash: tokenHash });
  return match ?? null;
}

/**
 * Update the customer's consent. Withdrawing location consent deletes the
 * stored live location and trail immediately.
 */
export async function updateOrderConsent(
  id: string,
  change: Partial<Pick<OrderConsent, "location" | "smsUpdates">>
): Promise<Order | null> {
  return store.update(id, (draft) => {
    const current = draft.consent ?? { location: false, smsUpdates: true, updatedAt: draft.placedAt };
    draft.consent = {
      location: change.location ?? current.location,
      smsUpdates: change.smsUpdates ?? current.smsUpdates,
      updatedAt: new Date().toISOString(),
    };
    if (!draft.consent.location) {
      draft.location = null;
      draft.locationHistory = [];
    }
    return clone(draft);
  });
}

/** Days a closed order keeps the customer's precise address pin. */
export const ADDRESS_PIN_RETENTION_DAYS = 30;

/** Drop location data a closed order no longer needs. Returns true when anything changed. */
function redactClosedOrder(order: Order, now: Date): boolean {
  if (!isTerminalStatus(order.status)) return false;
  const cutoff = now.getTime() - ADDRESS_PIN_RETENTION_DAYS * 86_400_000;
  let touched = false;
  if (order.location || order.locationHistory?.length) {
    order.location = null;
    order.locationHistory = [];
    touched = true;
  }
  if (order.riderTokenHash) {
    delete order.riderTokenHash;
    touched = true;
  }
  const closedAt = Date.parse(order.closedAt ?? order.timeline?.at(-1)?.at ?? order.placedAt);
  const hasPin = order.address.lat !== undefined || order.address.lng !== undefined;
  if (hasPin && !Number.isNaN(closedAt) && closedAt < cutoff) {
    delete order.address.lat;
    delete order.address.lng;
    delete order.address.accuracy;
    delete order.address.locationAt;
    order.pinRedactedAt = now.toISOString();
    touched = true;
  }
  return touched;
}

/**
 * Retention sweep: closed orders older than the window lose the precise GPS
 * pin on their address (estate/street stay for the station's records), and
 * any location data a closed order still carries is dropped.
 */
export async function applyOrderRetention(now = new Date()): Promise<number> {
  let changed = 0;
  for (const order of await store.find({ status: TERMINAL_STATUSES })) {
    if (!redactClosedOrder(clone(order), now)) continue;
    const touched = await store.update(order.id, (draft) => redactClosedOrder(draft, now));
    if (touched) changed += 1;
  }
  return changed;
}

/**
 * Append a live location fix. With a `guard`, the fix is refused (inside the
 * same locked write) when the guard returns a reason.
 */
export async function recordLocation(
  id: string,
  loc: OrderLocation,
  guard?: (order: Order) => string | null
): Promise<Order | { error: string } | null> {
  return store.update(id, (draft) => {
    const blocked = guard?.(clone(draft));
    if (blocked) return { error: blocked };
    draft.location = loc;
    draft.locationHistory = [...(draft.locationHistory ?? []), loc].slice(-LOCATION_HISTORY_CAP);
    return clone(draft);
  });
}

/** Location fixes are accepted only while the order is active and the customer has opted in. */
export function locationBlockReason(order: Order): string | null {
  if (!isActiveStatus(order.status)) return "This order is closed, so live location is no longer collected.";
  if (!order.consent?.location) return "Live location sharing is off for this order.";
  return null;
}

/** Record a refund handoff (or its outcome) on the order. */
export async function setOrderRefund(id: string, refund: Order["refund"]): Promise<Order | null> {
  return store.update(id, (draft) => {
    draft.refund = refund;
    return clone(draft);
  });
}
