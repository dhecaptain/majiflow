import type { BusinessProduct } from "@/lib/types";

/**
 * The shopper-facing water categories, named the same everywhere: the home
 * page tiles, the station list filter and the station menu.
 */
export type WaterCategoryId = "refills" | "new-bottles" | "bottled-packs" | "dispensers";

export const WATER_CATEGORY_IDS: readonly WaterCategoryId[] = ["refills", "new-bottles", "bottled-packs", "dispensers"];

export const WATER_CATEGORY_LABELS: Record<WaterCategoryId, string> = {
  refills: "Refills",
  "new-bottles": "New bottles",
  "bottled-packs": "Bottled packs",
  dispensers: "Dispensers",
};

export function isWaterCategory(value: string): value is WaterCategoryId {
  return (WATER_CATEGORY_IDS as readonly string[]).includes(value);
}

/** Whether one menu item belongs to a shopper-facing category. */
export function productInCategory(
  product: Pick<BusinessProduct, "category" | "unit">,
  category: WaterCategoryId
): boolean {
  if (category === "refills") return product.category === "refill";
  if (category === "dispensers") return product.category === "dispenser";
  if (product.category !== "bottled") return false;
  return category === "new-bottles" ? product.unit === "can" : product.unit !== "can";
}

/** Whether a station sells anything in a category. */
export function offersCategory(
  business: { products: readonly Pick<BusinessProduct, "category" | "unit">[] },
  category: WaterCategoryId
): boolean {
  return business.products.some((product) => productInCategory(product, category));
}
