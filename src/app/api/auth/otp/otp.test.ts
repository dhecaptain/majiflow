import { describe, expect, it, vi } from "vitest";

const otp = vi.hoisted(() => ({
  OtpError: class OtpError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
    }
  },
  checkOtpRequestRate: vi.fn(),
  issueOtp: vi.fn(async () => ({
    code: "123456",
    expiresAt: new Date(Date.now() + 600_000),
    resendAfterSeconds: 60,
  })),
  otpErrorMessage: (code: string) => `message:${code}`,
  hasLiveOtp: vi.fn(async () => true),
  verifyOtp: vi.fn(async () => undefined),
}));

const auth = vi.hoisted(() => ({
  findUserByPhone: vi.fn<() => Promise<{ id: string } | null>>(async () => null),
}));

const sms = vi.hoisted(() => ({
  sendSms: vi.fn(async () => ({ sent: true, provider: "dev", devCode: "123456" })),
}));

vi.mock("@/lib/server/otp", () => otp);
vi.mock("@/lib/server/auth", () => auth);
vi.mock("@/lib/server/sms", () => sms);

import { POST } from "./request/route";
import { POST as verify } from "./verify/route";

function post(body: unknown) {
  return new Request("http://localhost/api/auth/otp/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp/request", () => {
  it("sends a code to a Kenyan number and reports a new customer", async () => {
    auth.findUserByPhone.mockResolvedValueOnce(null);
    const response = await POST(post({ phone: "0712 345 678" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("new");
    expect(sms.sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: "254712345678" }));
  });

  it("reports an existing customer so the sheet can welcome them back", async () => {
    auth.findUserByPhone.mockResolvedValueOnce({ id: "u1" });
    const response = await POST(post({ phone: "+254712345678" }));

    expect((await response.json()).status).toBe("registered");
  });

  it("refuses a number that is not Kenyan", async () => {
    const response = await POST(post({ phone: "12345" }));

    expect(response.status).toBe(422);
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it("answers 429 when the customer asks for codes too quickly", async () => {
    otp.checkOtpRequestRate.mockImplementationOnce(() => {
      throw new otp.OtpError("rate", "Too many requests.");
    });
    const response = await POST(post({ phone: "0712345678" }));

    expect(response.status).toBe(429);
  });
});

describe("POST /api/auth/otp/verify", () => {
  it("rejects a wrong code with a message the sheet can show", async () => {
    otp.verifyOtp.mockRejectedValueOnce(new otp.OtpError("invalid", "That code is not right."));
    const response = await verify(post({ phone: "0712345678", code: "000000" }));

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("invalid");
  });

  it("refuses a number that is not Kenyan", async () => {
    const response = await verify(post({ phone: "nope", code: "123456" }));

    expect(response.status).toBe(422);
  });
});
