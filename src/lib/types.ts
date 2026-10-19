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
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "mpesa" | "card";

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

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
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
  total: number;
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
    items: { productId: string; name: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    deliveryFee: number;
    total: number;
  };
  address: DeliveryAddress;
  placedAt: string;
  eta?: string;
  timeline?: OrderTimelineEntry[];
  location?: OrderLocation | null;
  locationHistory?: OrderLocation[];
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
