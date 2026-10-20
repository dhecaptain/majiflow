import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  allowedTransitions,
  FULFILLMENT_FLOW,
  needsRefund,
  nextStationStep,
  TERMINAL_STATUSES,
  transitionBlockReason,
} from "@/lib/order-status";
import { makeOrder } from "@/lib/testing/factories";
import type { Order } from "@/lib/types";

const paid = (partial: Partial<Order>) => makeOrder({ paymentState: "success", ...partial });

describe("order lifecycle", () => {
  it("walks the station flow one step at a time", () => {
    expect(FULFILLMENT_FLOW).toEqual(["pending", "accepted", "preparing", "rider_assigned", "out_for_delivery", "delivered"]);
    expect(nextStationStep(paid({ status: "accepted" }))).toBe("preparing");
    expect(nextStationStep(paid({ status: "delivered" }))).toBeNull();
    expect(nextStationStep(paid({ status: "rejected" }))).toBeNull();
  });

  it("treats delivered, rejected and cancelled as final", () => {
    expect(TERMINAL_STATUSES).toEqual(["delivered", "rejected", "cancelled"]);
    for (const status of TERMINAL_STATUSES) {
      expect(ACTIVE_STATUSES).not.toContain(status);
      for (const actor of ["station", "admin", "rider", "customer"] as const) {
        expect(allowedTransitions(status, actor)).toEqual([]);
      }
      expect(transitionBlockReason(paid({ status }), "pending", "admin")).toMatch(/can no longer change/);
    }
  });

  it("gives each actor only its own moves", () => {
    expect(allowedTransitions("pending", "station")).toEqual(["accepted", "rejected"]);
    expect(allowedTransitions("pending", "customer")).toEqual(["cancelled"]);
    expect(allowedTransitions("accepted", "customer")).toEqual([]);
    expect(allowedTransitions("rider_assigned", "rider")).toEqual(["out_for_delivery"]);
    expect(allowedTransitions("out_for_delivery", "rider")).toEqual(["delivered"]);
    expect(allowedTransitions("preparing", "rider")).toEqual([]);
    expect(transitionBlockReason(paid({ status: "preparing" }), "out_for_delivery", "station")).toMatch(/cannot move/);
    expect(transitionBlockReason(paid({ status: "rider_assigned" }), "cancelled", "rider")).toMatch(/not allowed/);
  });

  it("gates acceptance on verified payment and dispatch on a named rider", () => {
    expect(transitionBlockReason(makeOrder({ status: "pending", paymentState: "pending" }), "accepted", "station")).toMatch(
      /Payment has not been confirmed/
    );
    expect(transitionBlockReason(paid({ status: "pending" }), "accepted", "station")).toBeNull();
    expect(transitionBlockReason(paid({ status: "preparing" }), "rider_assigned", "station")).toMatch(/rider/);
    expect(
      transitionBlockReason(
        paid({ status: "preparing", rider: { name: "Ann", phone: "0722000111", assignedAt: "2026-09-21T10:00:00Z" } }),
        "rider_assigned",
        "station"
      )
    ).toBeNull();
  });

  it("asks for a refund only when a paid order closes undelivered", () => {
    expect(needsRefund({ status: "rejected", paymentState: "success" })).toBe(true);
    expect(needsRefund({ status: "cancelled", paymentState: "success" })).toBe(true);
    expect(needsRefund({ status: "rejected", paymentState: "pending" })).toBe(false);
    expect(needsRefund({ status: "delivered", paymentState: "success" })).toBe(false);
    expect(needsRefund({ status: "cancelled", paymentState: "refunded" })).toBe(false);
  });
});
