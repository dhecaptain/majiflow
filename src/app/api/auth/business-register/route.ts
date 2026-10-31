import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";
import { AuthenticationError, createSession, createUserAccount } from "@/lib/server/auth";
import { reportFailure } from "@/lib/monitoring";

export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `business-register:ip:${clientIp(request)}`, rule: LIMITS.registerPerIp }]);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const user = await createUserAccount(body, "business_owner");
    await createSession(user.id);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 422 });
    if (isUniqueViolation(error)) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    await reportFailure("store", "Could not create business owner account.", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorCode: getErrorCode(error) ?? "UNKNOWN",
      causeCode: getErrorCode(error, true) ?? "UNKNOWN",
    });
    return Response.json({ error: "Could not create business owner account." }, { status: 500 });
  }
}

function getErrorCode(error: unknown, nestedOnly = false): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return undefined;
    if (!nestedOnly && depth === 0 && "code" in current && typeof current.code === "string") return current.code;
    if ("cause" in current) {
      current = current.cause;
      if (nestedOnly && current && typeof current === "object" && "code" in current && typeof current.code === "string") {
        return current.code;
      }
    } else {
      return undefined;
    }
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return getErrorCode(error) === "23505" || getErrorCode(error, true) === "23505";
}
