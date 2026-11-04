import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * DEV-ONLY: finishes the OpenStreetMap OAuth2 test login started at
 * /osm-login, then shows which OSM account authorised the app. The access
 * token is never displayed or stored. Disabled in production.
 */

const OSM_TOKEN = "https://www.openstreetmap.org/oauth2/token";
const OSM_USER = "https://api.openstreetmap.org/api/0.6/user/details.json";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>${escapeHtml(title)}</h1>${body}<p><a href="/osm-login">Try again</a></p></body>`;
  const res = new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
  res.cookies.delete("osm_oauth_state");
  res.cookies.delete("osm_oauth_verifier");
  return res;
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });

  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    return page("OSM login refused", `<p>${escapeHtml(error)}: ${escapeHtml(params.get("error_description"))}</p>`, 400);
  }

  const code = params.get("code");
  const state = params.get("state");
  const savedState = request.cookies.get("osm_oauth_state")?.value;
  const verifier = request.cookies.get("osm_oauth_verifier")?.value;
  if (!code || !state || !savedState || !verifier || state !== savedState) {
    return page(
      "OSM login failed",
      "<p>Missing or mismatched state. Start from <code>http://127.0.0.1:3001/osm-login</code> (not <code>localhost</code>) so the cookies match the callback host.</p>",
      400
    );
  }

  const tokenRes = await fetch(OSM_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OSM_OAUTH_REDIRECT_URI ?? "",
      client_id: process.env.OSM_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.OSM_OAUTH_CLIENT_SECRET ?? "",
      code_verifier: verifier,
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as Record<string, string>;
  if (!tokenRes.ok || !token.access_token) {
    return page("Token exchange failed", `<pre>${escapeHtml(JSON.stringify(token, null, 2))}</pre>`, 502);
  }

  const userRes = await fetch(OSM_USER, { headers: { authorization: `Bearer ${token.access_token}` } });
  const data = (await userRes.json().catch(() => ({}))) as { user?: Record<string, unknown> };
  const user = data.user;
  if (!userRes.ok || !user) {
    return page("Fetching user failed", `<p>HTTP ${userRes.status}</p>`, 502);
  }

  return page(
    "OSM login works ✅",
    `<p>Logged in as <strong>${escapeHtml(user.display_name)}</strong> (OSM id ${escapeHtml(user.id)}).</p>
<p>Granted scope: <code>${escapeHtml(token.scope)}</code></p>
<p>Account created: ${escapeHtml(user.account_created)}</p>`
  );
}
