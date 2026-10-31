import { reportFailure } from "@/lib/monitoring";
import {
  AuthenticationError,
  authenticatePhone,
  createPhoneAccount,
  createSession,
  findUserByPhone,
} from "@/lib/server/auth";
import { hasLiveOtp, OtpError, otpErrorMessage, verifyOtp, type OtpPurpose } from "@/lib/server/otp";
import { normalizeKenyanPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Check the code the customer typed.
 *
 * A number that already has an account signs in; a new number creates the
 * account, which is why the name is only needed on the sign-up path.
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
  const code = typeof data.code === "string" ? data.code : "";
  const name = typeof data.name === "string" ? data.name : "";

  try {
    const existing = await findUserByPhone(phone);
    // The code was issued for one of the two purposes; find the one that is live.
    const order: OtpPurpose[] = existing ? ["login", "register"] : ["register", "login"];
    let purpose = order[0];
    for (const candidate of order) {
      if (await hasLiveOtp(phone, candidate)) {
        purpose = candidate;
        break;
      }
    }

    await verifyOtp(phone, code, purpose);

    const user = existing ? await authenticatePhone(phone) : await createPhoneAccount(name, phone);
    await createSession(user.id);
    return Response.json({ user });
  } catch (error) {
    if (error instanceof OtpError) {
      return Response.json({ error: otpErrorMessage(error.code), code: error.code }, { status: 422 });
    }
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    await reportFailure("store", "Could not complete phone sign-in.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "We could not sign you in. Please try again." }, { status: 500 });
  }
}
