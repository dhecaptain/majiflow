import { describe, expect, it } from "vitest";
import { validateBusinessApplication } from "./business-application-validation";

const validApplication = {
  businessName: "Clear Water",
  ownerName: "Amina Yusuf",
  phone: "+254712345678",
  email: "AMINA@example.com",
  address: "Kasarani Road",
  city: "Nairobi",
  deliveryFee: "50.005",
  deliveryTimeMinutes: "45",
  plan: "growth",
  latitude: "-1.23",
  longitude: "36.81",
};

describe("validateBusinessApplication", () => {
  it("normalizes a valid application for persistence", () => {
    const result = validateBusinessApplication(validApplication);

    expect(result).toEqual({
      success: true,
      data: {
        businessName: "Clear Water",
        ownerName: "Amina Yusuf",
        phone: "+254712345678",
        email: "amina@example.com",
        address: "Kasarani Road",
        city: "Nairobi",
        deliveryFee: 50.01,
        deliveryTimeMinutes: 45,
        plan: "growth",
        description: null,
        registrationNumber: null,
        zones: null,
        latitude: -1.23,
        longitude: 36.81,
      },
    });
  });

  it("rejects missing required fields and invalid values", () => {
    const result = validateBusinessApplication({
      ...validApplication,
      businessName: " ",
      email: "not-an-email",
      deliveryFee: "-1",
      deliveryTimeMinutes: "45.5",
      plan: "enterprise",
    });

    expect(result).toEqual({
      success: false,
      errors: {
        businessName: "Business name is required",
        email: "Email is invalid",
        deliveryFee: "Delivery fee is invalid",
        deliveryTimeMinutes: "Delivery time is invalid",
        plan: "Plan is invalid",
      },
    });
  });

  it("requires coordinates to be supplied as a pair and within bounds", () => {
    const result = validateBusinessApplication({
      ...validApplication,
      latitude: 91,
      longitude: undefined,
    });

    expect(result).toEqual({
      success: false,
      errors: {
        location: "Latitude and longitude are both required",
        latitude: "Latitude is invalid",
      },
    });
  });

  it("allows an application without coordinates", () => {
    const result = validateBusinessApplication({
      ...validApplication,
      latitude: null,
      longitude: null,
    });

    expect(result.success).toBe(true);
  });
});
