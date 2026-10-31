import type { StaticImageData } from "next/image";

export type PlanName = "starter" | "growth" | "pro";

export interface Plan {
  id: PlanName;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  trialDays: number;
  /** What the plan includes today. */
  features: string[];
  /** Announced on the pricing pages and shipping next. */
  planned?: string[];
  highlighted?: boolean;
  cta: string;
  audience: string;
}

/**
 * A choice the customer makes about a product, e.g. handing back an empty can
 * for a refund. Options are priced by the catalog, never by the client.
 */
export interface ProductOption {
  id: string;
  label: string;
  /** Added to (or taken off) the product's base price. */
  priceDelta: number;
  /** Refundable deposit collected with the order and returned on the swap. */
  deposit?: number;
  /** Stock for this option alone; falls back to the product's own stock. */
  stock?: number;
}

export interface BusinessProduct {
  id: string;
  name: string;
  unit: string;
  price: number;
  oldPrice?: number;
  description: string;
  category: "remineralised" | "refill" | "dispenser" | "bottled";
  stock: number;
  stockLow: number;
  popular?: boolean;
  image: string;
  /** Choices the customer picks before the item goes in the cart. */
  options?: ProductOption[];
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface OperatingHours {
  /** Local opening time in 24-hour HH:mm format. */
  open: string;
  /** Local closing time in 24-hour HH:mm format; earlier than open means overnight. */
  close: string;
}

/** Missing days mean hours have not been supplied; null means confirmed closed. */
export type WeeklyOperatingHours = Partial<Record<Weekday, OperatingHours | null>>;

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "rider_assigned"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "mpesa" | "card";

/** How the customer receives the order: a rider delivers it, or they collect it. */
export type FulfillmentMethod = "delivery" | "pickup";

/**
 * Payment lifecycle, written server-side only. Clients must never submit
 * `success` (or any terminal state): an order is created `pending` and moves
 * only through verified provider callbacks, status reconciliation, or an
 * explicit refund flow. `timeout` marks a pending payment that outlived its
 * confirmation window; `refunded` is set only after provider confirmation.
 */
export type PaymentState = "pending" | "success" | "failed" | "cancelled" | "timeout" | "refunded";

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** The chosen product option, when the product offers a choice. */
  optionId?: string;
  /** Label of the chosen option, kept so the order still reads after a catalog edit. */
  optionLabel?: string;
  /** Refundable deposit charged per unit of this line. */
  deposit?: number;
}

export interface DeliveryAddress {
  /** Server id for addresses saved to a signed-in customer's account. */
  id?: string;
  label: string;
  estate: string;
  street?: string;
  building?: string;
  floor?: string;
  city?: string;
  landmark?: string;
  notes?: string;
  phone: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  locationAt?: string;
}

export interface OrderLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
}

/** Who moved an order: station staff, the assigned rider, the customer, the platform admin or the system. */
export type FulfillmentActor = "station" | "rider" | "customer" | "admin" | "system";

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
  actor?: FulfillmentActor;
  /** Customer-safe note, e.g. a rejection reason or the rider's first name. */
  note?: string;
}

export interface OrderRider {
  name: string;
  phone: string;
  assignedAt: string;
}

/** Refund handed off to the payments service after a paid order is rejected or cancelled. */
export interface OrderRefund {
  id: string;
  status: "pending" | "confirmed" | "failed";
  amount: number;
  requestedAt: string;
  confirmedAt?: string;
  /** Why the handoff could not be opened automatically (support follows up). */
  error?: string;
}

/** Customer consent captured at checkout and changeable from the tracking page. */
export interface OrderConsent {
  /** Stream the customer's live location to the station while the order is active. */
  location: boolean;
  /** Transactional SMS status updates for this order. */
  smsUpdates: boolean;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  /**
   * Owning customer account, stamped server-side from the session at checkout.
   * Never accepted from the client; guest orders have none.
   */
  customerUserId?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  /** Refundable deposits collected with the order (can swaps, container hire). */
  deposit?: number;
  total: number;
  /** Delivery by a rider, or collection from the station. Defaults to delivery. */
  fulfilment?: FulfillmentMethod;
  payment: PaymentMethod;
  paymentState: PaymentState;
  status: OrderStatus;
  /**
   * Immutable snapshot of the server-side pricing decision. The top-level
   * items/subtotal/deliveryFee/total always carry these verified numbers, so
   * later catalog edits can never rewrite a confirmed order; the snapshot
   * records when and at which catalog prices the totals were settled.
   */
  pricingSnapshot?: {
    verifiedAt: string;
    items: {
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      optionId?: string;
      optionLabel?: string;
      deposit?: number;
    }[];
    subtotal: number;
    deliveryFee: number;
    deposit?: number;
    total: number;
  };
  address: DeliveryAddress;
  placedAt: string;
  eta?: string;
  timeline?: OrderTimelineEntry[];
  location?: OrderLocation | null;
  locationHistory?: OrderLocation[];
  consent?: OrderConsent;
  rider?: OrderRider;
  /** SHA-256 of the rider's one-order access token. Server-only; never leaves the store. */
  riderTokenHash?: string;
  /** Customer-facing reason recorded with a rejection or cancellation. */
  closedReason?: string;
  closedAt?: string;
  refund?: OrderRefund;
  /** Set once the precise address pin has been dropped under the retention policy. */
  pinRedactedAt?: string;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  city: string;
  estates: string[];
  rating: number;
  reviewCount: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  avgDeliveryMinutes: number;
  /** How far the station delivers, in km from the station. */
  deliveryRadiusKm?: number;
  /** Discount (%) for customers who collect in person instead of delivery. */
  nearbyDiscountPercent?: number;
  verified: boolean;
  /** True once the business has approved status AND an active paid subscription. */
  paid: boolean;
  acceptsMpesa: boolean;
  acceptsCard: boolean;
  subscription: PlanName;
  description: string;
  products: BusinessProduct[];
  /** Canonical source for published hours until station settings are backed by a service. */
  openingHours?: WeeklyOperatingHours;
  accent: string;
  cover: StaticImageData;
  lat: number;
  lng: number;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  location: string;
  initials: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  group: "customers" | "businesses" | "billing";
}

export interface Stat {
  id: string;
  value: string;
  label: string;
  delta?: string;
  trend?: "up" | "down";
  icon: string;
}

export interface StockAlert {
  id: string;
  name: string;
  stock: number;
  threshold: number;
  unit: string;
}
