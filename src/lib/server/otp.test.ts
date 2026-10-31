import { describe, expect, it } from "vitest";
import {
  checkOtpRequestRate,
  generateOtpCode,
  hashOtpCode,
  OtpError,
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/server/otp";

describe("generateOtpCode", () => {
  it("is six digits", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode", () => {
  it("is stable for the same code and number", () => {
    expect(hashOtpCode("123456", "0712345678")).toBe(hashOtpCode("123456", "0712345678"));
  });

  it("does not collide across numbers", () => {
    expect(hashOtpCode("123456", "0712345678")).not.toBe(hashOtpCode("123456", "0712345679"));
  });

  it("never contains the code itself", () => {
    expect(hashOtpCode("123456", "0712345678")).not.toContain("123456");
  });
});

describe("checkOtpRequestRate", () => {
  it("lets a caller ask a few times and then stops them", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      expect(() => checkOtpRequestRate(key)).not.toThrow();
    }
    expect(() => checkOtpRequestRate(key)).toThrow(OtpError);
  });

  it("forgets a caller once the window has passed", () => {
    const key = `test-${Math.random()}`;
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) checkOtpRequestRate(key, now);
    expect(() => checkOtpRequestRate(key, now + 11 * 60_000)).not.toThrow();
  });
});

describe("otp constants", () => {
  it("keeps the codes short-lived and hard to guess", () => {
    expect(OTP_CODE_LENGTH).toBe(6);
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
    expect(OTP_RESEND_COOLDOWN_MS).toBe(60 * 1000);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
});
