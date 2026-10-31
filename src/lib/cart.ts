import type { Business, BusinessProduct, ProductOption } from "@/lib/types";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";

export interface CartLine {
  businessId: string;
  productId: string;
  quantity: number;
  /** The product option the customer chose, when the product offers a choice. */
  optionId?: string;
}

/** Upper bound for one line, so a stray tap can't build an order a rider can't carry. */
export const MAX_LINE_QUANTITY = 20;

/**
 * Identity of a cart line. The option is part of it: the same product with a
 * different option is a different line, so a can swap never merges into a
 * plain refill.
 */
export function cartLineKey(line: Pick<CartLine, "businessId" | "productId" | "optionId">): string {
  return `${line.businessId}:${line.productId}:${line.optionId ?? ""}`;
}

/** The option a line chose, if the product still offers it. */
export function optionFor(
  product: Pick<BusinessProduct, "options">,
  optionId: string | undefined
): ProductOption | undefined {
  if (!optionId) return undefined;
  return product.options?.find((option) => option.id === optionId);
}

/** Price of one unit with the chosen option applied. */
export function unitPriceFor(
  product: Pick<BusinessProduct, "price">,
  option?: Pick<ProductOption, "priceDelta">
): number {
  return product.price + (option?.priceDelta ?? 0);
}

/** Refundable deposit collected per unit for the chosen option. */
export function depositFor(option?: Pick<ProductOption, "deposit">): number {
  return option?.deposit ?? 0;
}

/** Largest quantity a customer can pick right now: never above live stock. */
export function maxOrderQuantity(
  product: Pick<BusinessProduct, "stock">,
  option?: Pick<ProductOption, "stock">
): number {
  const stock = option?.stock ?? product.stock;
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(stock)));
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
    const { businessId, productId, quantity, optionId } = entry as Record<string, unknown>;
    if (typeof businessId !== "string" || !businessId) continue;
    if (typeof productId !== "string" || !productId) continue;
    if (typeof quantity !== "number") continue;
    const line: CartLine = {
      businessId,
      productId,
      quantity: 0,
      ...(typeof optionId === "string" && optionId ? { optionId } : {}),
    };
    const key = cartLineKey(line);
    const total = clampQuantity((merged.get(key)?.quantity ?? 0) + clampQuantity(quantity));
    if (total > 0) merged.set(key, { ...line, quantity: total });
  }
  return [...merged.values()];
}

/** The one station the cart belongs to, or null when it is empty or mixed. */
export function cartStationId(items: readonly CartLine[]): string | null {
  const ids = new Set(items.map((line) => line.businessId));
  if (ids.size !== 1) return null;
  return [...ids][0];
}

export type CartLineStatus = "ok" | "missing" | "out-of-stock" | "over-stock" | "option-missing";

export interface ResolvedCartLine {
  line: CartLine;
  business?: Business;
  product?: BusinessProduct;
  /** The option the line chose, when the product offers a choice. */
  option?: ProductOption;
  /** Price of one unit with the option applied. */
  unitPrice: number;
  /** Refundable deposit per unit for the chosen option. */
  deposit: number;
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
  /** The station the cart belongs to; null when the cart is empty or mixed. */
  stationId: string | null;
  /** True when the cart still holds items from more than one station. */
  mixedStations: boolean;
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
        unitPrice: 0,
        deposit: 0,
        status: "missing",
        max: 0,
        problem: business
          ? `${business.name} no longer sells this item.`
          : "This station is no longer on MajiConnect.",
      };
    }
    // An option the customer picked is priced by the catalog, never by the
    // cart, and a choice that no longer exists has to be made again.
    const option = optionFor(product, line.optionId);
    if (line.optionId && !option) {
      return {
        line,
        business,
        product,
        unitPrice: 0,
        deposit: 0,
        status: "option-missing",
        max: 0,
        problem: `That choice for ${product.name} is no longer available - pick another.`,
      };
    }
    const unitPrice = unitPriceFor(product, option);
    const deposit = depositFor(option);
    const max = maxOrderQuantity(product, option);
    if (max === 0) {
      return {
        line,
        business,
        product,
        option,
        unitPrice,
        deposit,
        status: "out-of-stock",
        max,
        problem: `${product.name} is out of stock.`,
      };
    }
    if (line.quantity > max) {
      return {
        line,
        business,
        product,
        option,
        unitPrice,
        deposit,
        status: "over-stock",
        max,
        problem: `Only ${max} available - lower the quantity to continue.`,
      };
    }
    return { line, business, product, option, unitPrice, deposit, status: "ok", max, problem: null };
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

  const stationIds = new Set(items.map((line) => line.businessId));
  const mixedStations = stationIds.size > 1;

  return {
    lines,
    orderable,
    problems,
    stationBlockers,
    stationId: cartStationId(items),
    mixedStations,
    canCheckout:
      lines.length > 0 &&
      problems.length === 0 &&
      stationBlockers.length === 0 &&
      !mixedStations,
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
