import { describe, expect, it } from "vitest";
import {
  formatKenyanPhone,
  isKenyanMobile,
  maskKenyanPhone,
  normalizeKenyanPhone,
  toE164,
} from "@/lib/phone";

describe("normalizeKenyanPhone", () => {
  it("keeps the local form for every spelling of the same number", () => {
    for (const input of ["0712345678", "+254712345678", "254712345678", "254 712 345 678", "0712 345 678", "(0712) 345-678"]) {
      expect(normalizeKenyanPhone(input)).toBe("0712345678");
    }
  });

  it("accepts the newer 01 prefixes", () => {
    expect(normalizeKenyanPhone("0112345678")).toBe("0112345678");
    expect(normalizeKenyanPhone("+254112345678")).toBe("0112345678");
  });

  it("rejects anything that is not a Kenyan number", () => {
    for (const input of ["", "   ", "12345", "071234567", "07123456789", "+12025550123", "07abc45678", null, undefined, 42]) {
      expect(normalizeKenyanPhone(input)).toBeNull();
    }
  });
});

describe("isKenyanMobile", () => {
  it("accepts 07 and 01 lines", () => {
    expect(isKenyanMobile("0712345678")).toBe(true);
    expect(isKenyanMobile("+254112345678")).toBe(true);
  });

  it("rejects a landline", () => {
    expect(isKenyanMobile("0201234567")).toBe(false);
  });
});

describe("toE164", () => {
  it("gives the number an SMS provider expects", () => {
    expect(toE164("0712345678")).toBe("254712345678");
    expect(toE164("0112345678")).toBe("254112345678");
    expect(toE164("nope")).toBeNull();
  });
});

describe("formatKenyanPhone", () => {
  it("groups the digits for reading", () => {
    expect(formatKenyanPhone("0712345678")).toBe("0712 345 678");
    expect(formatKenyanPhone("nope")).toBe("");
  });
});

describe("maskKenyanPhone", () => {
  it("keeps only the last three digits", () => {
    expect(maskKenyanPhone("0712345678")).toBe("+254 ••• ••• 678");
  });
});
