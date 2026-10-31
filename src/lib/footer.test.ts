import { describe, expect, it } from "vitest";
import { shouldShowFooter } from "./footer";

describe("shouldShowFooter", () => {
  it.each([
    "/",
    "/about",
    "/about/team",
    "/how-it-works",
    "/pricing",
    "/faqs",
    "/contact",
    "/for-business",
    "/privacy",
    "/terms",
  ])("shows on marketing page %s", (path) => {
    expect(shouldShowFooter(path)).toBe(true);
  });

  it.each([
    "/browse",
    "/browse/lake-aqua",
    "/cart",
    "/checkout",
    "/order/123",
    "/login",
    "/register",
    "/account",
    "/account/orders",
    "/business",
    "/business/register",
    "/admin",
    "/rider",
    "/rider/token",
  ])("stays off app page %s", (path) => {
    expect(shouldShowFooter(path)).toBe(false);
  });

  it("stays off when the pathname is unavailable", () => {
    expect(shouldShowFooter(null)).toBe(false);
    expect(shouldShowFooter(undefined)).toBe(false);
  });
});
