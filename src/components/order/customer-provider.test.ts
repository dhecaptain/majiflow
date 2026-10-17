import { describe, expect, it } from "vitest";
import { profileForSession, profileFromAccount, type CustomerProfile } from "./customer-provider";

const stored: CustomerProfile = {
  name: "Old Customer",
  phone: "0700000000",
  email: "old@example.com",
  addresses: [{ label: "Home", estate: "Old Estate", city: "Nairobi", phone: "0700000000" }],
  defaultAddressIndex: 0,
};

describe("customer session isolation", () => {
  it("does not reuse another customer's persisted profile", () => {
    expect(profileForSession(stored, {
      name: "Current Customer",
      email: "current@example.com",
      role: "customer",
    })).toEqual({
      name: "Current Customer",
      phone: "",
      email: "current@example.com",
      addresses: [],
      defaultAddressIndex: 0,
    });
  });

  it("clears customer state for a business-owner session", () => {
    expect(profileForSession(stored, {
      name: "Business Owner",
      email: "owner@example.com",
      role: "business_owner",
    })).toEqual({
      name: "",
      phone: "",
      addresses: [],
      defaultAddressIndex: 0,
    });
  });
});

describe("profileFromAccount", () => {
  it("uses the server account and points at its default address", () => {
    const profile = profileFromAccount(
      { name: "Jane", phone: "0712345678", email: "jane@example.com" },
      [
        { id: "a1", label: "Work", estate: "Upper Hill", phone: "0712345678", isDefault: false },
        { id: "a2", label: "Home", estate: "South B", phone: "0712345678", isDefault: true },
      ]
    );
    expect(profile.defaultAddressIndex).toBe(1);
    expect(profile.addresses[1]).toEqual({ id: "a2", label: "Home", estate: "South B", phone: "0712345678" });
    expect(profile.email).toBe("jane@example.com");
  });
});
