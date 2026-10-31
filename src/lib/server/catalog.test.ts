import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { businesses as demoStations } from "@/lib/data/businesses";
import type { Business } from "@/lib/types";

const state = vi.hoisted(() => ({ rows: [] as Business[], fail: false }));

vi.mock("@/lib/server/station-publication", () => ({
  queryEligiblePublishedDatabaseBusinesses: async () => {
    if (state.fail) throw new Error("database down");
    return state.rows.map((station) => ({ business: { id: station.id }, application: {}, subscription: null, station }));
  },
  mapDatabaseBusinessToPublic: (_b: unknown, _a: unknown, _s: unknown, products: Business["products"]) => ({
    ...state.rows[0],
    products,
  }),
  storefrontMissingFields: ({ openingHours, visibleProductCount }: { openingHours?: unknown; visibleProductCount: number }) =>
    [...(openingHours ? [] : ["openingHours"]), ...(visibleProductCount > 0 ? [] : ["products"])],
}));

const products = vi.hoisted(() => ({ list: [] as Business["products"] }));
vi.mock("@/lib/server/station-products", () => ({
  productsForStations: async (ids: string[]) => new Map(ids.map((id) => [id, products.list])),
}));

vi.mock("@/lib/server/db", () => ({ getDatabase: async () => ({ db: {} }) }));

const realStation: Business = {
  ...demoStations[0],
  id: "0f8b8f8e-1111-4222-8333-444455556666",
  slug: "kisumu-pure",
  name: "Kisumu Pure",
};

async function catalog() {
  vi.resetModules();
  return import("./catalog");
}

beforeEach(() => {
  state.rows = [realStation];
  state.fail = false;
  products.list = realStation.products;
  process.env.DATABASE_URL = "postgresql://test";
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.DATABASE_URL;
});

describe("station catalog", () => {
  it("lists only database stations in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { listStations } = await catalog();
    expect((await listStations()).map((s) => s.slug)).toEqual(["kisumu-pure"]);
  });

  it("adds demo stations only when they are enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MF_DEMO_STATIONS", "1");
    const { listStations } = await catalog();
    const slugs = (await listStations()).map((s) => s.slug);
    expect(slugs[0]).toBe("kisumu-pure");
    expect(slugs).toContain("bio-water-kasarani");
  });

  it("hides a published station with nothing to sell", async () => {
    vi.stubEnv("NODE_ENV", "production");
    products.list = [];
    const { listStations } = await catalog();
    expect(await listStations()).toEqual([]);
  });

  it("fails loudly instead of showing demo stations when the database is down", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.fail = true;
    const { listStations } = await catalog();
    await expect(listStations()).rejects.toThrow("database down");
  });

  it("never takes an order for a demo station in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getOrderableStation } = await catalog();
    expect(await getOrderableStation("bio-water-kasarani")).toBeNull();
    expect((await getOrderableStation(realStation.id))?.slug).toBe("kisumu-pure");
  });
});
