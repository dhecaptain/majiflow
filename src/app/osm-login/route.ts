import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * DEV-ONLY: starts an OpenStreetMap OAuth2 (PKCE) login to test the app
 * credentials in .env.local. Finished by /callback. Disabled in production.
 */

const OSM_AUTHORIZE = "https://www.openstreetmap.org/oauth2/authorize";
// Ask for the least we need to prove the login works, not everything the app is allowed.
const SCOPE = "read_prefs";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });

  const clientId = process.env.OSM_OAUTH_CLIENT_ID;
  const redirectUri = process.env.OSM_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new NextResponse("OSM_OAUTH_CLIENT_ID / OSM_OAUTH_REDIRECT_URI missing from .env.local", { status: 500 });
  }

  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL(OSM_AUTHORIZE);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const res = NextResponse.redirect(url);
  const cookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("osm_oauth_state", state, cookie);
  res.cookies.set("osm_oauth_verifier", verifier, cookie);
  return res;
}
