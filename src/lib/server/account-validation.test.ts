import { describe, expect, it } from "vitest";
import {
  addressKey,
  validateAddressInput,
  validatePreferencesInput,
  validateProfileInput,
} from "@/lib/server/account-validation";

describe("validateAddressInput", () => {
  it("normalises a valid address and falls back to the account phone", () => {
    const result = validateAddressInput({ estate: " South B ", building: "Singa Court", makeDefault: true }, "0712345678");
    if ("errors" in result) throw new Error(JSON.stringify(result.errors));
    expect(result.address).toMatchObject({
      label: "Home",
      estate: "South B",
      building: "Singa Court",
      phone: "0712345678",
      latitude: null,
      makeDefault: true,
    });
  });

  it("requires an estate and a reachable phone", () => {
    const result = validateAddressInput({ estate: "" }, null);
    expect(result).toHaveProperty("errors.estate");
    expect(result).toHaveProperty("errors.phone");
  });

  it("rejects half a coordinate", () => {
    expect(validateAddressInput({ estate: "Kasarani", lat: -1.2 }, "0712345678")).toHaveProperty("errors.location");
  });

  it("keeps both coordinates and the capture time", () => {
    const result = validateAddressInput(
      { estate: "Kasarani", lat: -1.22, lng: 36.9, accuracy: 15, locationAt: "2026-09-21T07:00:00.000Z" },
      "0712345678"
    );
    if ("errors" in result) throw new Error(JSON.stringify(result.errors));
    expect(result.address.latitude).toBe(-1.22);
    expect(result.address.longitude).toBe(36.9);
    expect(result.address.locationAt?.toISOString()).toBe("2026-09-21T07:00:00.000Z");
  });
});

describe("validateProfileInput", () => {
  it("accepts a name and Kenyan phone", () => {
    expect(validateProfileInput({ name: "Jane  Wanjiku", phone: "+254 712 345 678" })).toEqual({
      profile: { name: "Jane Wanjiku", phone: "0712345678" },
    });
  });

  it("refuses email changes and bad input", () => {
    const result = validateProfileInput({ name: "J", phone: "123", email: "x@y.z" });
    expect(result).toHaveProperty("errors.name");
    expect(result).toHaveProperty("errors.phone");
    expect(result).toHaveProperty("errors.email");
  });
});

describe("validatePreferencesInput", () => {
  it("takes only boolean switches", () => {
    expect(validatePreferencesInput({ marketing: true })).toEqual({ preferences: { marketing: true } });
    expect(validatePreferencesInput({ orderUpdates: "yes" })).toHaveProperty("errors.orderUpdates");
    expect(validatePreferencesInput({})).toHaveProperty("errors._form");
  });
});

describe("addressKey", () => {
  it("treats case and spacing differences as the same place", () => {
    expect(addressKey({ estate: "South B ", building: "Singa" })).toBe(addressKey({ estate: "south b", building: " SINGA" }));
  });
});
