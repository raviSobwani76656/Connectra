import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { DRIVE_SCOPE, GOOGLE_ENDPOINTS, GOOGLE_ISSUERS, GOOGLE_SCOPES, GOOGLE_TIMEOUT_MS, type GoogleClientConfig } from "./config";
import { googleFetch } from "./http";
import {
  idTokenClaimsSchema,
  oauthErrorSchema,
  refreshResponseSchema,
  tokenResponseSchema,
  type IdTokenClaims,
  type TokenResponse,
} from "./schemas";

/** Cryptographically random, URL-safe string (32 bytes ≈ 43 characters by default). */
export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE S256 code challenge (RFC 7636). */
export function pkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

/** Constant-time string comparison; false for different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_ENDPOINTS.authorize);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
  }).toString();
  return url.toString();
}

export function hasDriveScope(scope: string): boolean {
  return scope.split(" ").includes(DRIVE_SCOPE);
}

type Failure<R extends string> = { ok: false; reason: R };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Server-to-server code exchange (step 7) with response validation (step 8). */
export async function exchangeCode(
  config: GoogleClientConfig,
  code: string,
  codeVerifier: string,
): Promise<{ ok: true; tokens: TokenResponse } | Failure<"request_failed" | "rejected" | "invalid_response">> {
  let response: Response;
  try {
    response = await googleFetch(GOOGLE_ENDPOINTS.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
    });
  } catch {
    logAuthErrorInDev("google.exchangeCode", { code: "request_failed" });
    return { ok: false, reason: "request_failed" };
  }
  const body = await readJson(response);
  if (!response.ok) {
    logAuthErrorInDev("google.exchangeCode", {
      code: oauthErrorSchema.safeParse(body).data?.error ?? "http_error",
      status: response.status,
    });
    return { ok: false, reason: "rejected" };
  }
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) {
    logAuthErrorInDev("google.exchangeCode", { code: "invalid_response", status: response.status });
    return { ok: false, reason: "invalid_response" };
  }
  return { ok: true, tokens: parsed.data };
}

let googleKeys: JWTVerifyGetKey | undefined;

function getGoogleKeys(): JWTVerifyGetKey {
  // jose caches the key set in memory and refetches when Google rotates keys.
  googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_ENDPOINTS.jwks), { timeoutDuration: GOOGLE_TIMEOUT_MS });
  return googleKeys;
}

/**
 * Step 9: verify the ID token's signature (Google's JWKS, RS256), iss, aud, exp and nonce.
 * `keys` is injectable for unit tests.
 */
export async function verifyIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  keys: JWTVerifyGetKey = getGoogleKeys(),
): Promise<{ ok: true; claims: IdTokenClaims } | Failure<"invalid_token" | "invalid_claims" | "nonce_mismatch">> {
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: GOOGLE_ISSUERS,
      audience: expected.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "nonce"],
      clockTolerance: 5,
    }));
  } catch (error) {
    logAuthErrorInDev("google.verifyIdToken", {
      code: error instanceof Error && "code" in error ? String(error.code) : "invalid_token",
    });
    return { ok: false, reason: "invalid_token" };
  }
  const claims = idTokenClaimsSchema.safeParse(payload);
  if (!claims.success) {
    logAuthErrorInDev("google.verifyIdToken", { code: "invalid_claims" });
    return { ok: false, reason: "invalid_claims" };
  }
  if (!safeEqual(claims.data.nonce, expected.nonce)) {
    logAuthErrorInDev("google.verifyIdToken", { code: "nonce_mismatch" });
    return { ok: false, reason: "nonce_mismatch" };
  }
  return { ok: true, claims: claims.data };
}

/** A fresh access token from the stored refresh token. The access token is never stored. */
export async function refreshAccessToken(
  config: Pick<GoogleClientConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<{ ok: true; accessToken: string } | Failure<"invalid_grant" | "temporary">> {
  let response: Response;
  try {
    response = await googleFetch(GOOGLE_ENDPOINTS.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
  } catch {
    logAuthErrorInDev("google.refresh", { code: "request_failed" });
    return { ok: false, reason: "temporary" };
  }
  const body = await readJson(response);
  if (!response.ok) {
    const code = oauthErrorSchema.safeParse(body).data?.error;
    logAuthErrorInDev("google.refresh", { code: code ?? "http_error", status: response.status });
    // invalid_grant: the refresh token expired or was revoked (Google OAuth docs).
    return { ok: false, reason: code === "invalid_grant" ? "invalid_grant" : "temporary" };
  }
  const parsed = refreshResponseSchema.safeParse(body);
  if (!parsed.success) {
    logAuthErrorInDev("google.refresh", { code: "invalid_response", status: response.status });
    return { ok: false, reason: "temporary" };
  }
  return { ok: true, accessToken: parsed.data.access_token };
}

/** Best-effort revocation. Revoking a refresh token removes the app's access. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await googleFetch(GOOGLE_ENDPOINTS.revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    if (!response.ok) {
      logAuthErrorInDev("google.revoke", { code: "http_error", status: response.status });
    }
    return response.ok;
  } catch {
    logAuthErrorInDev("google.revoke", { code: "request_failed" });
    return false;
  }
}
