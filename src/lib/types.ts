import type { StaticImageData } from "next/image";

export type PlanName = "starter" | "growth" | "pro";

export interface Plan {
  id: PlanName;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  trialDays: number;
  features: string[];
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

export type OrderStatus =
  | "pending"
  | "accepted"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "mpesa" | "card";

export type PaymentState = "pending" | "success" | "failed";

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface DeliveryAddress {
  label: string;
  estate: string;
  street?: string;
  building?: string;
  floor?: string;
  notes?: string;
  phone: string;
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
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  payment: PaymentMethod;
  paymentState: PaymentState;
  status: OrderStatus;
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

export interface DashboardOrderRow {
  id: string;
  orderNumber: string;
  customer: string;
  area: string;
  items: string;
  total: number;
  status: OrderStatus;
  time: string;
}

export interface DashboardStats {
  revenueToday: number;
  revenueTrend: number;
  ordersToday: number;
  pendingOrders: number;
  outForDelivery: number;
  comingToday: number;
  stockAlerts: StockAlert[];
  repeatCustomerRate: number;
  subscription: PlanName;
  nextBilling: string;
  chart: { period: string; revenue: number; orders: number }[];
  recentOrders: DashboardOrderRow[];
  popularProducts: { name: string; orders: number; revenue: number }[];
}

export interface StockAlert {
  id: string;
  name: string;
  stock: number;
  threshold: number;
  unit: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  location: string;
  orders: number;
  totalSpent: number;
  lastOrder: string;
  status: "active" | "new" | "dormant";
}