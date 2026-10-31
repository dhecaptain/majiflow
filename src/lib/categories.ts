/**
 * The shopper-facing water categories, named the same everywhere: the home
 * page tiles, the browse filter and the guided order steps.
 */
export type WaterCategoryId = "refills" | "new-bottles" | "bottled-packs" | "dispensers";

export const WATER_CATEGORY_LABELS: Record<WaterCategoryId, string> = {
  refills: "Refills",
  "new-bottles": "New bottles",
  "bottled-packs": "Bottled packs",
  dispensers: "Dispensers",
};
