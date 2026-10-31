import { describe, expect, it } from "vitest";
import { computeCartTotals, deliveryFeeForStation, lineSubtotal } from "@/lib/pricing";

const BIO = { id: "bio", deliveryFee: 120, freeDeliveryAbove: 1000 };
const TRU = { id: "tru", deliveryFee: 80, freeDeliveryAbove: 500 };

describe("lineSubtotal", () => {
  it("multiplies price by quantity", () => {
    expect(lineSubtotal(350, 3)).toBe(1050);
  });

  it("does not drift on fractional prices", () => {
    expect(lineSubtotal(0.1, 3)).toBe(0.3);
  });
});

describe("deliveryFeeForStation", () => {
  it("charges the fee below the free threshold", () => {
    expect(deliveryFeeForStation(700, BIO)).toBe(120);
  });

  it("is free exactly at the threshold", () => {
    expect(deliveryFeeForStation(1000, BIO)).toBe(0);
  });

  it("is free above the threshold", () => {
    expect(deliveryFeeForStation(1500, BIO)).toBe(0);
  });

  it("never charges for an empty group", () => {
    expect(deliveryFeeForStation(0, BIO)).toBe(0);
  });
});

describe("computeCartTotals", () => {
  it("adds a single station's fee to the total", () => {
    const totals = computeCartTotals([{ businessId: "bio", quantity: 2, unitPrice: 350 }], [BIO]);
    expect(totals).toMatchObject({ subtotal: 700, deliveryFee: 120, total: 820 });
  });

  it("applies free delivery per station, not to the whole cart", () => {
    // Two stations, each just under their own threshold, but 1100 together.
    // The old whole-cart rule made both free and under-charged at checkout.
    const totals = computeCartTotals(
      [
        { businessId: "bio", quantity: 2, unitPrice: 350 }, // bio 700 < 1000 -> 120
        { businessId: "tru", quantity: 6, unitPrice: 80 }, //  tru 480 < 500  -> 80
      ],
      [BIO, TRU]
    );
    expect(totals.subtotal).toBe(1180);
    expect(totals.deliveryFee).toBe(200);
    expect(totals.total).toBe(1380);
    expect(totals.groups).toEqual([
      { businessId: "bio", subtotal: 700, deliveryFee: 120, deposit: 0, total: 820 },
      { businessId: "tru", subtotal: 480, deliveryFee: 80, deposit: 0, total: 560 },
    ]);
  });

  it("waives the fee for a station that clears its own threshold while the other does not", () => {
    const totals = computeCartTotals(
      [
        { businessId: "bio", quantity: 3, unitPrice: 350 }, // 1050 -> free
        { businessId: "tru", quantity: 1, unitPrice: 300 }, // 300 -> 80
      ],
      [BIO, TRU]
    );
    expect(totals.groups.find((g) => g.businessId === "bio")?.deliveryFee).toBe(0);
    expect(totals.groups.find((g) => g.businessId === "tru")?.deliveryFee).toBe(80);
    expect(totals.deliveryFee).toBe(80);
  });

  it("sums repeated lines from the same station", () => {
    const totals = computeCartTotals(
      [
        { businessId: "bio", quantity: 1, unitPrice: 350 },
        { businessId: "bio", quantity: 2, unitPrice: 350 },
      ],
      [BIO]
    );
    expect(totals.groups).toHaveLength(1);
    expect(totals.subtotal).toBe(1050);
    expect(totals.deliveryFee).toBe(0);
  });

  it("returns zeroes for an empty cart", () => {
    expect(computeCartTotals([], [BIO, TRU])).toEqual({
      subtotal: 0,
      deliveryFee: 0,
      deposit: 0,
      total: 0,
      groups: [],
    });
  });

  it("never charges for an empty line", () => {
    const totals = computeCartTotals([{ businessId: "bio", quantity: 0, unitPrice: 350 }], [BIO]);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("collects refundable deposits on top of the item price", () => {
    const totals = computeCartTotals(
      [{ businessId: "bio", quantity: 2, unitPrice: 350, deposit: 350 }],
      [BIO]
    );
    expect(totals.subtotal).toBe(700);
    expect(totals.deposit).toBe(700);
    expect(totals.deliveryFee).toBe(120);
    expect(totals.total).toBe(1520);
  });

  it("never collects a deposit for a line without one", () => {
    const totals = computeCartTotals(
      [{ businessId: "bio", quantity: 2, unitPrice: 350, deposit: 0 }],
      [BIO]
    );
    expect(totals.deposit).toBe(0);
    expect(totals.total).toBe(820);
  });
});
