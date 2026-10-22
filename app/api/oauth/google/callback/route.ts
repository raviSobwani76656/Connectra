import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { getCurrentUser } from "@/lib/auth/dal";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { dashboardUrl, type DashboardMessageCode } from "@/lib/dashboard/messages";
import { getGoogleClientConfig, OAUTH_COOKIE_NAME, OAUTH_COOKIE_PATH } from "@/lib/google/config";
import { saveGoogleConnection } from "@/lib/google/connection";
import { exchangeCode, hasDriveScope, safeEqual, verifyIdToken } from "@/lib/google/oauth";
import { openOAuthFlow } from "@/lib/google/oauth-cookie";
import { callbackQuerySchema } from "@/lib/google/schemas";

/**
 * GET /api/oauth/google/callback (FR-05, D-009, D-020). Steps run in the order of the P2
 * spec; any failure deletes the OAuth cookie, logs only a code and stores nothing.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const clearFlowCookie = () =>
    cookieStore.set(OAUTH_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: OAUTH_COOKIE_PATH, maxAge: 0 });

  const fail = (logCode: string, message: DashboardMessageCode = "google-error"): never => {
    logAuthErrorInDev("google.callback", { code: logCode });
    clearFlowCookie();
    redirect(dashboardUrl(message));
  };

  // 1. Signed-in user.
  const user = await getCurrentUser();
  if (!user) {
    clearFlowCookie();
    redirect(LOGIN_PATH);
  }

  // 2. Query parameters (first value of each; bounded sizes and characters).
  const params = request.nextUrl.searchParams;
  const query = callbackQuerySchema.safeParse({
    code: params.get("code") ?? undefined,
    state: params.get("state") ?? undefined,
    error: params.get("error") ?? undefined,
  });
  if (!query.success) {
    return fail("invalid_query");
  }

  // 3. Errors reported by Google.
  if (query.data.error) {
    return query.data.error === "access_denied"
      ? fail("access_denied", "google-cancelled")
      : fail("google_error");
  }
  if (!query.data.code || !query.data.state) {
    return fail("missing_code_or_state");
  }

  // 4. The sealed flow cookie, opened for this user only (missing, expired or other user → null).
  const flow = openOAuthFlow(cookieStore.get(OAUTH_COOKIE_NAME)?.value, user.id, Date.now());
  if (!flow) {
    return fail("invalid_flow_cookie");
  }

  // 5. State, in constant time.
  if (!safeEqual(query.data.state, flow.state)) {
    return fail("state_mismatch");
  }

  // 6. One-time use.
  clearFlowCookie();

  // 7–8. Code exchange (10 s timeout) and token response validation.
  const config = getGoogleClientConfig();
  const exchanged = await exchangeCode(config, query.data.code, flow.codeVerifier);
  if (!exchanged.ok) {
    return fail(`exchange_${exchanged.reason}`);
  }
  const tokens = exchanged.tokens;

  // 9. ID token: signature, iss, aud, exp, nonce.
  const verified = await verifyIdToken(tokens.id_token, { clientId: config.clientId, nonce: flow.nonce });
  if (!verified.ok) {
    return fail(`id_token_${verified.reason}`);
  }

  // 10. Drive permission actually granted (users can untick it).
  if (!hasDriveScope(tokens.scope)) {
    return fail("drive_scope_missing", "google-insufficient-scope");
  }

  // 11. A refresh token is required for a persistent connection.
  if (!tokens.refresh_token) {
    return fail("refresh_token_missing");
  }

  // 12–14. Values from the verified ID token only; encrypted and upserted under RLS.
  const saved = await saveGoogleConnection({
    refreshToken: tokens.refresh_token,
    email: verified.claims.email,
    name: verified.claims.name || null,
  });
  if (!saved) {
    return fail("save_failed");
  }

  // 15. Done. Access and ID tokens are discarded here.
  redirect(dashboardUrl("google-connected"));
}
