import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import {
  getGoogleClientConfig,
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  OAUTH_COOKIE_NAME,
  OAUTH_COOKIE_PATH,
} from "@/lib/google/config";
import { buildAuthorizationUrl, pkceChallenge, randomUrlSafe } from "@/lib/google/oauth";
import { sealOAuthFlow } from "@/lib/google/oauth-cookie";

/** GET /api/oauth/google/start: begins the Google connection (FR-05, D-009, D-020). */
export async function GET() {
  const user = await requireUser();
  const config = getGoogleClientConfig();

  const state = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  const codeVerifier = randomUrlSafe(48); // 64 characters, within PKCE's 43–128

  const cookieStore = await cookies();
  cookieStore.set(
    OAUTH_COOKIE_NAME,
    sealOAuthFlow({ state, nonce, codeVerifier, userId: user.id, issuedAt: Date.now() }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
      secure: config.redirectUri.startsWith("https://"),
    },
  );

  redirect(
    buildAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      nonce,
      codeChallenge: pkceChallenge(codeVerifier),
    }),
  );
}
