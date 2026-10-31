import { and, asc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businessProducts, businesses } from "@/lib/server/db/schema";
import type { BusinessProduct, ProductOption } from "@/lib/types";

/**
 * A station's own products, managed by its owner from the dashboard. These
 * rows are the authoritative catalog for database stations: checkout prices,
 * stock and options all come from here.
 */

export const PRODUCT_CATEGORIES = ["refill", "bottled", "remineralised", "dispenser"] as const;
export const PRODUCT_IMAGES = ["can", "bottle", "glass", "dispenser"] as const;
const MAX_OPTIONS = 6;

export class ProductValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super("Please fix the highlighted fields.");
  }
}
export class ProductNotFoundError extends Error {}

type ProductRow = typeof businessProducts.$inferSelect;

export interface ProductInput {
  name: string;
  description: string;
  category: BusinessProduct["category"];
  unit: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  stockLow: number;
  image: string;
  popular: boolean;
  options: ProductOption[];
  isVisible: boolean;
}

function money(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;
}

function count(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function readOptions(value: unknown, errors: Record<string, string>): ProductOption[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_OPTIONS) {
    errors.options = `Add up to ${MAX_OPTIONS} choices.`;
    return [];
  }
  const options: ProductOption[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const label = text(o.label, 60);
    const priceDelta = typeof o.priceDelta === "number" && Number.isFinite(o.priceDelta) ? Math.round(o.priceDelta * 100) / 100 : null;
    const deposit = o.deposit === undefined || o.deposit === null || o.deposit === "" ? undefined : money(o.deposit);
    const stock = o.stock === undefined || o.stock === null || o.stock === "" ? undefined : count(o.stock);
    if (!label || priceDelta === null || deposit === null || stock === null) {
      errors.options = "Each choice needs a name and a valid price change.";
      return [];
    }
    let id = text(o.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "") || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    while (ids.has(id)) id = `${id}-${ids.size + 1}`;
    ids.add(id);
    options.push({ id, label, priceDelta, ...(deposit !== undefined ? { deposit } : {}), ...(stock !== undefined ? { stock } : {}) });
  }
  return options;
}

/** Validate an owner's product form. Throws ProductValidationError with per-field messages. */
export function validateProductInput(input: unknown): ProductInput {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};

  const name = text(o.name, 120);
  if (name.length < 2) errors.name = "Give the product a name.";
  const description = text(o.description, 500);
  if (description.length < 5) errors.description = "Describe the product in a few words.";
  const category = PRODUCT_CATEGORIES.find((c) => c === o.category);
  if (!category) errors.category = "Choose a category.";
  const unit = text(o.unit, 24) || "item";
  const price = money(o.price);
  if (price === null || price <= 0) errors.price = "Enter a price in KES.";
  const oldPrice = o.oldPrice === undefined || o.oldPrice === null || o.oldPrice === "" ? null : money(o.oldPrice);
  if (oldPrice !== null && price !== null && oldPrice <= price) errors.oldPrice = "The old price must be higher than the price.";
  const stock = count(o.stock ?? 0);
  if (stock === null) errors.stock = "Stock must be a whole number.";
  const stockLow = count(o.stockLow ?? 10);
  if (stockLow === null) errors.stockLow = "Reorder point must be a whole number.";
  const image = PRODUCT_IMAGES.find((key) => key === o.image) ?? "bottle";
  const options = readOptions(o.options, errors);

  if (Object.keys(errors).length > 0) throw new ProductValidationError(errors);
  return {
    name,
    description,
    category: category!,
    unit,
    price: price!,
    oldPrice,
    stock: stock!,
    stockLow: stockLow!,
    image,
    popular: o.popular === true,
    options,
    isVisible: o.isVisible !== false,
  };
}

export function toBusinessProduct(row: ProductRow): BusinessProduct {
  const options = Array.isArray(row.options) ? (row.options as ProductOption[]) : [];
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price),
    ...(row.oldPrice !== null ? { oldPrice: Number(row.oldPrice) } : {}),
    description: row.description,
    category: row.category as BusinessProduct["category"],
    stock: row.stock,
    stockLow: row.stockLow,
    popular: row.popular,
    image: row.image,
    ...(options.length ? { options } : {}),
    ...(row.isVisible ? {} : { hidden: true }),
  };
}

/** Products for these stations, keyed by station id. Hidden products only when asked. */
export async function productsForStations(
  businessIds: string[],
  { includeHidden = false } = {}
): Promise<Map<string, BusinessProduct[]>> {
  const result = new Map<string, BusinessProduct[]>();
  if (businessIds.length === 0) return result;
  const { db } = await getDatabase();
  const rows = await db
    .select()
    .from(businessProducts)
    .where(
      includeHidden
        ? inArray(businessProducts.businessId, businessIds)
        : and(inArray(businessProducts.businessId, businessIds), eq(businessProducts.isVisible, true))
    )
    .orderBy(asc(businessProducts.sortOrder), asc(businessProducts.createdAt));
  for (const row of rows) {
    const list = result.get(row.businessId) ?? [];
    list.push(toBusinessProduct(row));
    result.set(row.businessId, list);
  }
  return result;
}

async function assertOwner(businessId: string, ownerUserId: string) {
  const { db } = await getDatabase();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
    .limit(1);
  // Another owner's station is indistinguishable from a missing one.
  if (!business) throw new ProductNotFoundError("Station not found.");
}

function rowValues(input: ProductInput) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    unit: input.unit,
    price: input.price.toFixed(2),
    oldPrice: input.oldPrice === null ? null : input.oldPrice.toFixed(2),
    stock: input.stock,
    stockLow: input.stockLow,
    image: input.image,
    popular: input.popular,
    options: input.options.length ? input.options : null,
    isVisible: input.isVisible,
  };
}

export async function listStationProducts(businessId: string, ownerUserId: string): Promise<BusinessProduct[]> {
  await assertOwner(businessId, ownerUserId);
  return (await productsForStations([businessId], { includeHidden: true })).get(businessId) ?? [];
}

export async function createStationProduct(businessId: string, ownerUserId: string, input: ProductInput) {
  await assertOwner(businessId, ownerUserId);
  const { db } = await getDatabase();
  const [row] = await db
    .insert(businessProducts)
    .values({ ...rowValues(input), businessId, sortOrder: Date.now() % 2_000_000_000 })
    .returning();
  return toBusinessProduct(row);
}

/** Apply a full product form, or just a visibility/stock change when `partial` is set. */
export async function updateStationProduct(
  businessId: string,
  ownerUserId: string,
  productId: string,
  change: { input?: ProductInput; isVisible?: boolean; stock?: number }
) {
  await assertOwner(businessId, ownerUserId);
  const set: Partial<typeof businessProducts.$inferInsert> = { updatedAt: new Date() };
  if (change.input) Object.assign(set, rowValues(change.input));
  if (change.isVisible !== undefined) set.isVisible = change.isVisible;
  if (change.stock !== undefined) set.stock = change.stock;
  const { db } = await getDatabase();
  const [row] = await db
    .update(businessProducts)
    .set(set)
    .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, businessId)))
    .returning();
  if (!row) throw new ProductNotFoundError("Product not found.");
  return toBusinessProduct(row);
}

export async function deleteStationProduct(businessId: string, ownerUserId: string, productId: string) {
  await assertOwner(businessId, ownerUserId);
  const { db } = await getDatabase();
  const deleted = await db
    .delete(businessProducts)
    .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, businessId)))
    .returning({ id: businessProducts.id });
  if (deleted.length === 0) throw new ProductNotFoundError("Product not found.");
}

export { count as parseCount };
