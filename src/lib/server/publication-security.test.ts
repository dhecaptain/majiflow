import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateBusinessApplication } from "./business-application-validation";
import { businesses, getBusiness, getBusinessesByCity } from "@/lib/data/businesses";
import { validateOrder } from "@/lib/server/order-store";

/** Mon 21 Sep 2026, 10:00 Nairobi: inside BioWater's 06:00-20:00 window. */
const OPEN_HOURS = new Date("2026-09-21T07:00:00Z");

describe("Publication Security & Integrity", () => {
  describe("Client privilege escalation prevention", () => {
    it("strips privileged status, publication, and subscription fields from application inputs", () => {
      const maliciousInput = {
        businessName: "Clean Water Springs",
        ownerName: "John Doe",
        phone: "+254712345678",
        email: "john@example.com",
        address: "Moi Avenue",
        city: "Nairobi",
        deliveryFee: "100",
        deliveryTimeMinutes: "30",
        plan: "pro",
        // Privileged fields that untrusted clients might attempt to inject
        status: "approved",
        isPublished: true,
        isComplete: true,
        paymentConfirmedAt: "2026-10-16T12:00:00Z",
        paymentReference: "FAKE-REF",
      };

      const result = validateBusinessApplication(maliciousInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("status");
        expect(result.data).not.toHaveProperty("isPublished");
        expect(result.data).not.toHaveProperty("isComplete");
        expect(result.data).not.toHaveProperty("paymentConfirmedAt");
        expect(result.data).not.toHaveProperty("paymentReference");
      }
    });
  });

  describe("Seeded Demo Stations and Orders Integrity", () => {
    beforeEach(() => {
      // Order validation reads the wall clock when checking the station's
      // published hours, so freeze it to a fixed instant inside BioWater's
      // window: otherwise this test passes or fails depending on run time.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(OPEN_HOURS);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("preserves seeded demo stations in getBusiness and getBusinessesByCity", () => {
      expect(businesses.length).toBeGreaterThanOrEqual(6);

      const kasarani = getBusiness("bio-water-kasarani");
      expect(kasarani).toBeDefined();
      expect(kasarani?.name).toBe("BioWater Refill Station");
      expect(kasarani?.products.length).toBeGreaterThan(0);

      const nairobiStations = getBusinessesByCity("Nairobi");
      expect(nairobiStations.some((b) => b.slug === "bio-water-kasarani")).toBe(true);
    });

    it("preserves order validation and pricing against seeded stations", () => {
      const sampleStation = businesses[0];
      const sampleProduct = sampleStation.products[0];

      const validOrderPayload = {
        customerName: "Jane Doe",
        customerPhone: "+254700000000",
        businessId: sampleStation.id,
        businessName: sampleStation.name,
        payment: "mpesa",
        paymentState: "pending",
        status: "pending",
        placedAt: new Date().toISOString(),
        items: [
          {
            productId: sampleProduct.id,
            quantity: 1,
            unitPrice: sampleProduct.price,
          },
        ],
        subtotal: sampleProduct.price,
        deliveryFee: sampleStation.deliveryFee,
        total: sampleProduct.price + sampleStation.deliveryFee,
        address: {
          label: "Home",
          estate: sampleStation.estates[0] ?? "Kasarani",
          phone: "+254700000000",
        },
      };

      const validation = validateOrder(validOrderPayload);
      expect(validation.errors).toBeUndefined();
      expect(validation.order).toBeDefined();
      expect(validation.order?.total).toBe(sampleProduct.price + sampleStation.deliveryFee);
    });
  });
});
