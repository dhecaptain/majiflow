import { NextResponse, type NextRequest } from "next/server";

/**
 * Cross-site request guard for the API. Browsers state where a request came
 * from (`Sec-Fetch-Site`, `Origin`), so a state-changing call started by
 * another site is refused before it reaches a route, on top of the session
 * cookie's SameSite=Lax. Provider callbacks and cron are server-to-server and
 * authenticate with their own secrets, so they are exempt.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PREFIXES = ["/api/payments/callback", "/api/payments/reversal-result", "/api/cron/"];

function forbidden() {
  return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
}

export function proxy(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method)) return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return forbidden();

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return forbidden();
    }
    if (originHost !== host) return forbidden();
  } else if (origin === "null") {
    return forbidden();
  }
  // No browser provenance at all: a server-to-server caller (e.g. the admin
  // key), which every such route authenticates on its own.
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
