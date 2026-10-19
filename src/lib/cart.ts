import type { Business, BusinessProduct } from "@/lib/types";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";

export interface CartLine {
  businessId: string;
  productId: string;
  quantity: number;
}

/** Upper bound for one line, so a stray tap can't build an order a rider can't carry. */
export const MAX_LINE_QUANTITY = 20;

/** Largest quantity a customer can pick right now: never above live stock. */
export function maxOrderQuantity(product: Pick<BusinessProduct, "stock">): number {
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(product.stock)));
}

export function clampQuantity(quantity: number, max: number = MAX_LINE_QUANTITY): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(max, Math.floor(quantity)));
}

/**
 * Restore a cart from storage defensively: malformed entries are dropped,
 * duplicates are merged and quantities are capped, so a stale or tampered
 * cart can never carry invalid lines back into the journey.
 */
export function sanitizeCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, CartLine>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { businessId, productId, quantity } = entry as Record<string, unknown>;
    if (typeof businessId !== "string" || !businessId) continue;
    if (typeof productId !== "string" || !productId) continue;
    if (typeof quantity !== "number") continue;
    const key = `${businessId}:${productId}`;
    const total = clampQuantity((merged.get(key)?.quantity ?? 0) + clampQuantity(quantity));
    if (total > 0) merged.set(key, { businessId, productId, quantity: total });
  }
  return [...merged.values()];
}

export type CartLineStatus = "ok" | "missing" | "out-of-stock" | "over-stock";

export interface ResolvedCartLine {
  line: CartLine;
  business?: Business;
  product?: BusinessProduct;
  status: CartLineStatus;
  /** Highest quantity the station can fill for this line right now. */
  max: number;
  /** Customer-facing explanation when the line can't be ordered as is. */
  problem: string | null;
}

export interface StationBlocker {
  businessId: string;
  businessName: string;
  reason: string;
}

export interface ResolvedCart {
  lines: ResolvedCartLine[];
  /** Lines that resolve to a real station and product, in cart order. */
  orderable: ResolvedCartLine[];
  /** Lines that must be removed or corrected before checkout. */
  problems: ResolvedCartLine[];
  stationBlockers: StationBlocker[];
  canCheckout: boolean;
}

export function resolveCart(
  items: CartLine[],
  catalog: readonly Business[],
  now: Date = new Date()
): ResolvedCart {
  const lines = items.map((line): ResolvedCartLine => {
    const business = catalog.find((b) => b.id === line.businessId);
    const product = business?.products.find((p) => p.id === line.productId);
    if (!business || !product) {
      return {
        line,
        business,
        product,
        status: "missing",
        max: 0,
        problem: business
          ? `${business.name} no longer sells this item.`
          : "This station is no longer on MajiConnect.",
      };
    }
    const max = maxOrderQuantity(product);
    if (max === 0) {
      return { line, business, product, status: "out-of-stock", max, problem: `${product.name} is out of stock.` };
    }
    if (line.quantity > max) {
      return {
        line,
        business,
        product,
        status: "over-stock",
        max,
        problem: `Only ${max} available - lower the quantity to continue.`,
      };
    }
    return { line, business, product, status: "ok", max, problem: null };
  });

  const orderable = lines.filter((l) => l.status !== "missing");
  const problems = lines.filter((l) => l.status !== "ok");

  const stationBlockers: StationBlocker[] = [];
  for (const l of orderable) {
    const business = l.business!;
    if (stationBlockers.some((b) => b.businessId === business.id)) continue;
    const reason = getBusinessOrderBlockReason(business, now);
    if (reason) stationBlockers.push({ businessId: business.id, businessName: business.name, reason });
  }

  return {
    lines,
    orderable,
    problems,
    stationBlockers,
    canCheckout: lines.length > 0 && problems.length === 0 && stationBlockers.length === 0,
  };
}

export interface ProductRequirement {
  text: string;
  /** Another item at the same station that covers customers who can't meet the requirement. */
  alternative?: BusinessProduct;
}

const RECURRING_UNITS = new Set(["day", "week", "month", "year"]);

/** What a customer must know or have before ordering an item, derived from catalog data. */
export function productRequirements(product: BusinessProduct, business: Business): ProductRequirement[] {
  const requirements: ProductRequirement[] = [];
  if (product.category === "refill") {
    const replacement = business.products.find(
      (p) => p.id !== product.id && p.category === "bottled" && p.unit === "can"
    );
    requirements.push({
      text: "A refill swaps your empty can - have it ready for the rider.",
      alternative: replacement,
    });
  }
  if (RECURRING_UNITS.has(product.unit)) {
    requirements.push({
      text: `Priced per ${product.unit}. The quantity is the number of ${product.unit}s you're booking.`,
    });
  }
  return requirements;
}

export function itemHref(businessSlug: string, productId: string): string {
  return `/browse/${encodeURIComponent(businessSlug)}/${encodeURIComponent(productId)}`;
}
