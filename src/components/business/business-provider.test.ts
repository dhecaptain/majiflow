import { describe, expect, it } from "vitest";
import { resolveBusinessId } from "./business-provider";

describe("business dashboard selection", () => {
  it("does not resolve a local station selection without an approved owner association", () => {
    expect(resolveBusinessId("truflow-nyali")).toBeNull();
  });

  it("resolves only a station the owner owns", () => {
    expect(resolveBusinessId("truflow-nyali", ["truflow-nyali"])).toBe("truflow-nyali");
    expect(resolveBusinessId("truflow-nyali", ["bio-water-kasarani"])).toBe("bio-water-kasarani");
    expect(resolveBusinessId(null, ["bio-water-kasarani", "truflow-nyali"])).toBe("bio-water-kasarani");
  });

  it("falls back to the owner's first station when the saved one is not theirs", () => {
    expect(resolveBusinessId("someone-elses", ["7d1c2f8e-0000-4000-8000-000000000001"])).toBe(
      "7d1c2f8e-0000-4000-8000-000000000001"
    );
  });
});
