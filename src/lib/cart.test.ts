import { describe, expect, it } from "vitest";
import type { Business } from "@/lib/types";
import { businesses } from "@/lib/data/businesses";
import {
  MAX_LINE_QUANTITY,
  cartLineKey,
  cartStationId,
  itemHref,
  maxOrderQuantity,
  optionFor,
  productRequirements,
  resolveCart,
  sanitizeCartLines,
  unitPriceFor,
} from "@/lib/cart";

const station = businesses.find((b) => b.id === "bio-water-kasarani")!;
// Monday 10:00 in Nairobi - inside every published weekday schedule.
const OPEN = new Date("2026-10-19T07:00:00Z");
// Monday 03:00 in Nairobi.
const NIGHT = new Date("2026-10-19T00:00:00Z");

function withStock(stock: number): Business {
  return {
    ...station,
    products: station.products.map((p) => (p.id === "bw-refill-20" ? { ...p, stock } : p)),
  };
}

describe("maxOrderQuantity", () => {
  it("never exceeds stock or the per-line cap", () => {
    expect(maxOrderQuantity({ stock: 3 })).toBe(3);
    expect(maxOrderQuantity({ stock: 500 })).toBe(MAX_LINE_QUANTITY);
    expect(maxOrderQuantity({ stock: 0 })).toBe(0);
    expect(maxOrderQuantity({ stock: -4 })).toBe(0);
  });
});

describe("sanitizeCartLines", () => {
  it("drops malformed entries, merges duplicates and caps quantities", () => {
    expect(
      sanitizeCartLines([
        { businessId: "a", productId: "x", quantity: 2 },
        { businessId: "a", productId: "x", quantity: 3 },
        { businessId: "a", productId: "y", quantity: 99 },
        { businessId: "a", productId: "z", quantity: 0 },
        { businessId: "", productId: "x", quantity: 1 },
        { businessId: "a", productId: "x", quantity: "4" },
        null,
        "junk",
      ])
    ).toEqual([
      { businessId: "a", productId: "x", quantity: 5 },
      { businessId: "a", productId: "y", quantity: MAX_LINE_QUANTITY },
    ]);
  });

  it("returns an empty cart for non-array storage", () => {
    expect(sanitizeCartLines({ items: [] })).toEqual([]);
    expect(sanitizeCartLines(null)).toEqual([]);
  });
});

describe("resolveCart", () => {
  it("allows checkout for a valid cart while the station is open", () => {
    const cart = resolveCart([{ businessId: station.id, productId: "bw-refill-20", quantity: 2 }], businesses, OPEN);
    expect(cart.canCheckout).toBe(true);
    expect(cart.problems).toEqual([]);
    expect(cart.orderable[0].product?.id).toBe("bw-refill-20");
  });

  it("keeps unknown stations and products visible as unavailable instead of hiding them", () => {
    const cart = resolveCart(
      [
        { businessId: "gone-station", productId: "x", quantity: 1 },
        { businessId: station.id, productId: "retired", quantity: 1 },
      ],
      businesses,
      OPEN
    );
    expect(cart.lines.map((l) => l.status)).toEqual(["missing", "missing"]);
    expect(cart.lines[0].problem).toMatch(/no longer on MajiConnect/);
    expect(cart.lines[1].problem).toMatch(new RegExp(`${station.name} no longer sells`));
    expect(cart.orderable).toEqual([]);
    expect(cart.canCheckout).toBe(false);
  });

  it("flags out-of-stock and over-stock lines", () => {
    const line = { businessId: station.id, productId: "bw-refill-20", quantity: 5 };
    expect(resolveCart([line], [withStock(0)], OPEN).lines[0]).toMatchObject({ status: "out-of-stock", max: 0 });
    const over = resolveCart([line], [withStock(3)], OPEN);
    expect(over.lines[0]).toMatchObject({ status: "over-stock", max: 3 });
    expect(over.lines[0].problem).toMatch(/Only 3 available/);
    expect(over.canCheckout).toBe(false);
  });

  it("reports closed stations once and blocks checkout", () => {
    const cart = resolveCart(
      [
        { businessId: station.id, productId: "bw-refill-20", quantity: 1 },
        { businessId: station.id, productId: "bw-5l", quantity: 1 },
      ],
      businesses,
      NIGHT
    );
    expect(cart.problems).toEqual([]);
    expect(cart.stationBlockers).toHaveLength(1);
    expect(cart.stationBlockers[0]).toMatchObject({ businessId: station.id, businessName: station.name });
    expect(cart.canCheckout).toBe(false);
  });

  it("cannot check out an empty cart", () => {
    expect(resolveCart([], businesses, OPEN).canCheckout).toBe(false);
  });
});

describe("productRequirements", () => {
  it("explains the empty-can swap for refills and offers the station's replacement can", () => {
    const refill = station.products.find((p) => p.id === "bw-refill-20")!;
    const [req] = productRequirements(refill, station);
    expect(req.text).toMatch(/empty can/);
    expect(req.alternative?.id).toBe("bw-renew-20");
  });

  it("explains recurring pricing units", () => {
    const rental = station.products.find((p) => p.id === "bw-dispenser")!;
    expect(productRequirements(rental, station).map((r) => r.text)).toEqual([
      "Priced per month. The quantity is the number of months you're booking.",
    ]);
  });

  it("has nothing to add for plain bottles", () => {
    expect(productRequirements(station.products.find((p) => p.id === "bw-5l")!, station)).toEqual([]);
  });
});

describe("itemHref", () => {
  it("builds the item route under its station", () => {
    expect(itemHref("bio-water-kasarani", "bw-refill-20")).toBe("/browse/bio-water-kasarani/bw-refill-20");
  });
});

describe("product options", () => {
  const refill = station.products.find((p) => p.id === "bw-refill-20")!;

  it("keeps the option part of the line identity so choices never merge", () => {
    expect(cartLineKey({ businessId: "a", productId: "p", optionId: "swap-empty" })).not.toBe(
      cartLineKey({ businessId: "a", productId: "p", optionId: "new-can" })
    );
    expect(cartLineKey({ businessId: "a", productId: "p" })).not.toBe(
      cartLineKey({ businessId: "a", productId: "p", optionId: "swap-empty" })
    );
  });

  it("merges only lines that chose the same option", () => {
    expect(
      sanitizeCartLines([
        { businessId: "a", productId: "p", quantity: 2, optionId: "swap-empty" },
        { businessId: "a", productId: "p", quantity: 3, optionId: "swap-empty" },
        { businessId: "a", productId: "p", quantity: 1, optionId: "new-can" },
      ])
    ).toEqual([
      { businessId: "a", productId: "p", quantity: 5, optionId: "swap-empty" },
      { businessId: "a", productId: "p", quantity: 1, optionId: "new-can" },
    ]);
  });

  it("prices a line with the option delta and collects its deposit", () => {
    const cart = resolveCart(
      [{ businessId: station.id, productId: "bw-refill-20", quantity: 2, optionId: "swap-empty" }],
      businesses,
      OPEN
    );
    expect(cart.lines[0]).toMatchObject({
      status: "ok",
      unitPrice: refill.price - 50,
      deposit: 0,
      option: { id: "swap-empty" },
    });
  });

  it("collects the refundable deposit of the chosen option", () => {
    const cart = resolveCart(
      [{ businessId: station.id, productId: "bw-refill-20", quantity: 1, optionId: "new-can" }],
      businesses,
      OPEN
    );
    expect(cart.lines[0]).toMatchObject({ status: "ok", unitPrice: refill.price, deposit: 350 });
  });

  it("flags a choice the station no longer offers", () => {
    const cart = resolveCart(
      [{ businessId: station.id, productId: "bw-refill-20", quantity: 1, optionId: "gone" }],
      businesses,
      OPEN
    );
    expect(cart.lines[0]).toMatchObject({ status: "option-missing" });
    expect(cart.lines[0].problem).toMatch(/no longer available/);
    expect(cart.canCheckout).toBe(false);
  });

  it("caps the quantity by the stock of the chosen option, not the product", () => {
    const cart = resolveCart(
      [{ businessId: station.id, productId: "bw-dispenser", quantity: 10, optionId: "with-can" }],
      businesses,
      OPEN
    );
    expect(cart.lines[0]).toMatchObject({ status: "over-stock", max: 6 });
    expect(cart.lines[0].problem).toMatch(/Only 6 available/);
  });

  it("resolves the option and the price of one unit from the catalog", () => {
    const option = optionFor(refill, "new-can")!;
    expect(option.label).toBe("New can handed over");
    expect(unitPriceFor(refill, option)).toBe(refill.price);
    expect(optionFor(refill, "gone")).toBeUndefined();
  });
});

describe("one station per cart", () => {
  it("names the station the cart belongs to", () => {
    expect(cartStationId([{ businessId: "a", productId: "p", quantity: 1 }])).toBe("a");
    expect(cartStationId([])).toBeNull();
  });

  it("refuses to check out a cart that still holds two stations", () => {
    const cart = resolveCart(
      [
        { businessId: station.id, productId: "bw-refill-20", quantity: 1 },
        { businessId: "tru-flow-mombasa", productId: "tf-refill-20", quantity: 1 },
      ],
      businesses,
      OPEN
    );
    expect(cart.mixedStations).toBe(true);
    expect(cart.stationId).toBeNull();
    expect(cart.canCheckout).toBe(false);
  });
});
