import { describe, expect, it } from "vitest";
import { browseHref, safeJourneyHref } from "@/lib/journey";

describe("browseHref", () => {
  it("keeps city and search in the URL and omits defaults", () => {
    expect(browseHref("All cities", "")).toBe("/browse");
    expect(browseHref("Nairobi", "  kasarani ")).toBe("/browse?city=Nairobi&q=kasarani");
  });
});

describe("safeJourneyHref", () => {
  it("accepts in-app journey paths", () => {
    expect(safeJourneyHref("browse", "/browse?city=Nairobi&q=bio")).toBe("/browse?city=Nairobi&q=bio");
    expect(safeJourneyHref("station", "/browse/bio-water-kasarani")).toBe("/browse/bio-water-kasarani");
    expect(safeJourneyHref("station", "/browse/bio-water-kasarani/bw-refill-20")).toBe(
      "/browse/bio-water-kasarani/bw-refill-20"
    );
  });

  it("falls back for anything that could leave the journey", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/account", "/browse/a/b/c", "javascript:alert(1)", null]) {
      expect(safeJourneyHref("station", bad)).toBe("/browse");
    }
    expect(safeJourneyHref("browse", "/browse/bio-water-kasarani")).toBe("/browse");
  });
});
