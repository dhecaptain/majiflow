import { reportFailure } from "@/lib/monitoring";
import { findUserByPhone } from "@/lib/server/auth";
import { checkOtpRequestRate, issueOtp, OtpError, otpErrorMessage } from "@/lib/server/otp";
import { sendSms } from "@/lib/server/sms";
import { normalizeKenyanPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;

/**
 * Send a sign-in code to a Kenyan phone number.
 *
 * The server decides what the code is for: a number that already has an
 * account signs in, a new number signs up. The client only learns which of
 * the two it is, so the copy can say "welcome back" or "create your account".
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const phone = normalizeKenyanPhone(typeof data.phone === "string" ? data.phone : null);
  if (!phone) {
    return Response.json(
      {
        error: "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….",
        fields: { phone: "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX…." },
      },
      { status: 422 }
    );
  }

  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  try {
    checkOtpRequestRate(`phone:${phone}`);
    checkOtpRequestRate(`ip:${caller}`);
  } catch (error) {
    if (error instanceof OtpError) {
      return Response.json({ error: error.message, code: error.code }, { status: 429 });
    }
    throw error;
  }

  try {
    const existing = await findUserByPhone(phone);
    const purpose = existing ? "login" : "register";
    const issued = await issueOtp(phone, purpose);
    const sent = await sendSms({
      to: `254${phone.slice(1)}`,
      purpose: "otp",
      body: `Your MajiFlow code is ${issued.code}. It expires in ${CODE_TTL_MINUTES} minutes. Don't share it with anyone.`,
    });

    if (!sent.sent) {
      await reportFailure("notification", "Sign-in code could not be sent.", {
        provider: sent.provider,
        reason: sent.error ?? "unknown",
      });
      return Response.json(
        { error: "We could not send the code. Please try again in a moment." },
        { status: 502 }
      );
    }

    return Response.json({
      status: existing ? "registered" : "new",
      expiresInSeconds: Math.ceil((issued.expiresAt.getTime() - Date.now()) / 1000),
      resendAfterSeconds: issued.resendAfterSeconds,
      // Only the dev provider returns a code, and only outside production.
      ...(sent.devCode ? { devCode: sent.devCode } : {}),
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return Response.json({ error: otpErrorMessage(error.code), code: error.code }, { status: 429 });
    }
    await reportFailure("store", "Could not issue a sign-in code.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "We could not send the code. Please try again in a moment." }, { status: 500 });
  }
}
