import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_RADIUS_KM,
  deliverableStations,
  deliveryRadiusKm,
  discoverStations,
  estimateEtaMinutes,
} from "@/lib/station-discovery";
import { businesses } from "@/lib/data/businesses";
import type { Business } from "@/lib/types";

const NAIROBI = { lat: -1.2921, lng: 36.8219 };

const withOverrides = (overrides: Partial<Business>): Business => ({
  ...businesses[0],
  ...overrides,
});

describe("deliveryRadiusKm", () => {
  it("uses the published radius", () => {
    expect(deliveryRadiusKm(withOverrides({ deliveryRadiusKm: 4 }))).toBe(4);
  });

  it("falls back to the default when nothing is published", () => {
    expect(deliveryRadiusKm(withOverrides({ deliveryRadiusKm: undefined }))).toBe(
      DEFAULT_DELIVERY_RADIUS_KM
    );
  });
});

describe("estimateEtaMinutes", () => {
  it("adds travel time to the station's own average", () => {
    expect(estimateEtaMinutes(withOverrides({ avgDeliveryMinutes: 30 }), 5)).toBe(40);
  });
});

describe("discoverStations", () => {
  it("splits every result into delivering or nearby, never both", () => {
    const result = discoverStations({ city: "All cities", location: NAIROBI, byDistance: true });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.delivering.length + result.nearby.length).toBe(result.results.length);
    expect(result.delivering.every((s) => s.delivers)).toBe(true);
    expect(result.nearby.every((s) => !s.delivers)).toBe(true);
  });

  it("puts delivering stations before the ones that only deliver to themselves", () => {
    const result = discoverStations({ city: "All cities", location: NAIROBI, byDistance: true });

    const firstNotDelivering = result.results.findIndex((s) => !s.delivers);
    if (firstNotDelivering >= 0) {
      expect(result.results.slice(firstNotDelivering).every((s) => !s.delivers)).toBe(true);
    }
  });

  it("marks a station the customer is standing at as delivering", () => {
    const kasarani = businesses.find((b) => b.id === "bio-water-kasarani");
    if (!kasarani) throw new Error("The seeded Kasarani station is missing.");

    const result = discoverStations({
      city: "All cities",
      location: { lat: kasarani.lat, lng: kasarani.lng },
      byDistance: true,
    });
    const nearest = result.results[0];

    expect(nearest.business.id).toBe("bio-water-kasarani");
    expect(nearest.distanceKm).toBeLessThanOrEqual(deliveryRadiusKm(nearest.business));
    expect(nearest.delivers).toBe(true);
  });

  it("reports no delivering station for a point outside every radius", () => {
    // The Nairobi centre is inside the 40 km search window but outside the
    // radius of the stations that surround it.
    const result = discoverStations({
      city: "All cities",
      location: NAIROBI,
      byDistance: true,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.delivering).toEqual([]);
    expect(result.nearby.length).toBe(result.results.length);
  });

  it("estimates a rider time for every station with a distance", () => {
    const result = discoverStations({ city: "All cities", location: NAIROBI, byDistance: true });
    for (const station of result.results) {
      expect(station.etaMinutes).toBeGreaterThan(0);
    }
  });
});

describe("deliverableStations", () => {
  it("keeps only the stations that reach the customer", () => {
    const result = discoverStations({ city: "All cities", location: NAIROBI, byDistance: true });
    expect(deliverableStations(result.results)).toEqual(result.delivering);
  });
});
