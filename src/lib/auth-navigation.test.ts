import { describe, expect, it } from "vitest";
import { postLoginPath } from "./auth-navigation";

describe("post-login navigation", () => {
  it("sends business owners to the business dashboard", () => {
    expect(postLoginPath("business_owner")).toBe("/business");
  });

  it("sends customers to the customer dashboard", () => {
    expect(postLoginPath("customer")).toBe("/account");
  });
});
