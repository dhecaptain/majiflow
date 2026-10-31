import { describe, expect, it } from "vitest";
import { nairobiDate, rangeStart, stationState, summarizeOrders, type OrderFact } from "@/lib/server/admin-insights";
import { csvCell, toCsv } from "@/lib/csv";

// 31 Oct 2026, 10:00 in Nairobi.
const NOW = new Date("2026-10-31T07:00:00Z");

let seq = 0;
function fact(over: Partial<OrderFact> & { placedAt: Date }): OrderFact {
  seq += 1;
  return {
    id: `o${seq}`,
    businessId: "s1",
    businessName: "Station One",
    customerKey: "c1",
    status: "delivered",
    payment: "cod",
    paymentState: "success",
    total: 500,
    ...over,
  };
}

describe("rangeStart / nairobiDate", () => {
  it("starts the range at Nairobi midnight", () => {
    expect(rangeStart(NOW, 1).toISOString()).toBe("2026-10-30T21:00:00.000Z");
    expect(rangeStart(NOW, 7).toISOString()).toBe("2026-10-24T21:00:00.000Z");
  });

  it("buckets late-night UTC orders into the next Nairobi day", () => {
    expect(nairobiDate(new Date("2026-10-30T22:30:00Z"))).toBe("2026-10-31");
  });
});

describe("summarizeOrders", () => {
  it("counts the current window and compares with the previous one", () => {
    const facts = [
      fact({ placedAt: new Date("2026-10-31T05:00:00Z"), total: 400 }),
      fact({ placedAt: new Date("2026-10-30T05:00:00Z"), total: 600, businessId: "s2", businessName: "Station Two" }),
      fact({ placedAt: new Date("2026-10-29T05:00:00Z"), status: "cancelled", paymentState: "cancelled", customerKey: "0712345678" }),
      // previous 7-day window
      fact({ placedAt: new Date("2026-10-20T05:00:00Z"), total: 250 }),
      // too old for either window
      fact({ placedAt: new Date("2026-09-01T05:00:00Z"), total: 999 }),
    ];
    const summary = summarizeOrders(facts, 7, NOW);
    expect(summary.orders).toBe(3);
    expect(summary.previousOrders).toBe(1);
    expect(summary.delivered).toBe(2);
    expect(summary.deliveredValue).toBe(1000);
    expect(summary.previousDeliveredValue).toBe(250);
    expect(summary.averageOrderValue).toBe(500);
    expect(summary.failedRate).toBeCloseTo(1 / 3);
    expect(summary.customers).toBe(2);
    expect(summary.daily).toHaveLength(7);
    expect(summary.daily.at(-1)).toMatchObject({ date: "2026-10-31", orders: 1, value: 400 });
    expect(summary.topStations[0]).toMatchObject({ businessId: "s2", deliveredValue: 600 });
  });

  it("reports cash still to collect on open pay-on-delivery orders, whenever placed", () => {
    const facts = [
      fact({ placedAt: new Date("2026-09-01T05:00:00Z"), status: "out_for_delivery", paymentState: "pending", total: 700 }),
      fact({ placedAt: new Date("2026-10-31T05:00:00Z"), status: "accepted", paymentState: "pending", total: 300 }),
      fact({ placedAt: new Date("2026-10-31T05:00:00Z"), status: "accepted", payment: "mpesa", paymentState: "success", total: 900 }),
    ];
    const summary = summarizeOrders(facts, 30, NOW);
    expect(summary.activeNow).toBe(3);
    expect(summary.cashToCollect).toBe(1000);
    expect(summary.cashToCollectOrders).toBe(2);
    expect(summary.byPayment).toEqual({ cod: 1, mpesa: 1, other: 0 });
  });

  it("returns zeros, not NaN, when there are no orders", () => {
    const summary = summarizeOrders([], 30, NOW);
    expect(summary.averageOrderValue).toBe(0);
    expect(summary.failedRate).toBe(0);
    expect(summary.daily.every((d) => d.orders === 0)).toBe(true);
  });
});

describe("stationState", () => {
  const base = {
    suspendedAt: null,
    isPublished: true,
    isComplete: true,
    applicationApproved: true,
    subscriptionEligible: true,
    storefrontMissing: [],
  };
  it("is live only when every rule passes", () => {
    expect(stationState(base)).toBe("live");
    expect(stationState({ ...base, subscriptionEligible: false })).toBe("hidden");
    expect(stationState({ ...base, storefrontMissing: ["products"] })).toBe("hidden");
  });
  it("suspension wins over everything", () => {
    expect(stationState({ ...base, suspendedAt: new Date() })).toBe("suspended");
  });
  it("separates unpublished stations by completeness", () => {
    expect(stationState({ ...base, isPublished: false })).toBe("ready");
    expect(stationState({ ...base, isPublished: false, isComplete: false })).toBe("setup");
  });
});

describe("csv", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, true]])).toBe('"a","b"\r\n"1","true"');
  });
});
