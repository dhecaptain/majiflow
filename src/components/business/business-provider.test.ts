import { describe, expect, it } from "vitest";
import { resolveBusinessId } from "./business-provider";

describe("business dashboard selection", () => {
  it("does not resolve a local station selection without an approved owner association", () => {
    expect(resolveBusinessId("truflow-nyali")).toBeNull();
  });

  it("resolves only a seeded station explicitly associated with the owner", () => {
    expect(resolveBusinessId("truflow-nyali", ["truflow-nyali"])).toBe("truflow-nyali");
    expect(resolveBusinessId("truflow-nyali", ["bio-water-kasarani"])).toBeNull();
  });
});
