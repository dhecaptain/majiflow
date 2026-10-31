import { describe, expect, it } from "vitest";
import {
  addressKey,
  mergeAddressInput,
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

  it("refuses bad input", () => {
    const result = validateProfileInput({ name: "J", phone: "123" });
    expect(result).toHaveProperty("errors.name");
    expect(result).toHaveProperty("errors.phone");
  });

  it("takes an email for a phone-first customer and refuses a broken one", () => {
    expect(validateProfileInput({ name: "Jane Wanjiku", phone: "0712345678", email: "Jane@Example.com" })).toEqual({
      profile: { name: "Jane Wanjiku", phone: "0712345678", email: "jane@example.com" },
    });
    expect(validateProfileInput({ name: "Jane Wanjiku", phone: "0712345678", email: "nope" })).toHaveProperty(
      "errors.email"
    );
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

describe("mergeAddressInput", () => {
  const stored = {
    label: "Home",
    estate: "South B",
    street: "Mchumbi Rd",
    building: "Singa Court",
    floor: null,
    city: "Nairobi",
    landmark: null,
    notes: null,
    phone: "0712345678",
    latitude: -1.31,
    longitude: 36.84,
    accuracy: 12,
    locationAt: new Date("2026-10-17T19:00:00Z"),
  };

  function input(raw: Record<string, unknown>) {
    const result = validateAddressInput(raw, "0712345678");
    if ("errors" in result) throw new Error(JSON.stringify(result.errors));
    return result.address;
  }

  it("keeps saved details and the map pin when the same place is re-saved sparsely", () => {
    expect(mergeAddressInput(stored, input({ estate: "south b ", building: "SINGA COURT", floor: "3rd floor" }))).toEqual({
      ...stored,
      floor: "3rd floor",
    });
  });

  it("takes a fresh pin and new details when provided", () => {
    const merged = mergeAddressInput(
      stored,
      input({ estate: "South B", building: "Singa Court", city: "Mombasa", lat: -1.3, lng: 36.85, accuracy: 5, locationAt: "2026-10-17T20:00:00Z" })
    );
    expect(merged).toMatchObject({ label: "Home", city: "Mombasa", latitude: -1.3, longitude: 36.85, accuracy: 5 });
    expect(merged.locationAt?.toISOString()).toBe("2026-10-17T20:00:00.000Z");
  });
});
