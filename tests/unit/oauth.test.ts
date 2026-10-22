import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { omit, TEST_ENV } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));

const {
  buildAuthorizationUrl,
  exchangeCode,
  hasDriveScope,
  pkceChallenge,
  randomUrlSafe,
  refreshAccessToken,
  revokeToken,
  safeEqual,
  verifyIdToken,
} = await import("@/lib/google/oauth");

const CLIENT_ID = TEST_ENV.GOOGLE_CLIENT_ID;
const CONFIG = { clientId: CLIENT_ID, clientSecret: "test-client-secret", redirectUri: "http://localhost:3000/api/oauth/google/callback" };
const DRIVE = "https://www.googleapis.com/auth/drive.metadata.readonly";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("random values and PKCE (D-009)", () => {
  it("creates unpredictable URL-safe values", () => {
    const values = new Set(Array.from({ length: 50 }, () => randomUrlSafe()));
    expect(values.size).toBe(50);
    for (const value of values) expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("derives the S256 challenge (RFC 7636 appendix B test vector)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("compares strings in constant time and handles different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("checks the Drive scope as a whole word", () => {
    expect(hasDriveScope(`openid email ${DRIVE}`)).toBe(true);
    expect(hasDriveScope("openid email profile")).toBe(false);
    expect(hasDriveScope(`${DRIVE}x`)).toBe(false);
  });
});

describe("buildAuthorizationUrl (spec section 2)", () => {
  it("sends exactly the required parameters to Google", () => {
    const url = new URL(
      buildAuthorizationUrl({ clientId: CLIENT_ID, redirectUri: CONFIG.redirectUri, state: "s".repeat(43), nonce: "n".repeat(43), codeChallenge: "c".repeat(43) }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: "http://localhost:3000/api/oauth/google/callback",
      response_type: "code",
      scope: `openid email profile ${DRIVE}`,
      state: "s".repeat(43),
      nonce: "n".repeat(43),
      code_challenge: "c".repeat(43),
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
    });
  });
});

describe("verifyIdToken (SR-07, step 9)", () => {
  let jwks: ReturnType<typeof createLocalJWKSet>;
  let sign: (claims: Record<string, unknown>, opts?: { alg?: string; key?: CryptoKey; kid?: string }) => Promise<string>;
  let otherKey: CryptoKey;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-kid", alg: "RS256", use: "sig" };
    jwks = createLocalJWKSet({ keys: [jwk] });
    sign = (claims, opts = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "test-kid" })
        .sign(opts.key ?? privateKey);
  });

  const now = () => Math.floor(Date.now() / 1000);
  const base = () => ({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "1234567890",
    email: "a@example.com",
    name: "Test User",
    nonce: "expected-nonce-value",
    iat: now(),
    exp: now() + 3600,
  });
  const expected = { clientId: CLIENT_ID, nonce: "expected-nonce-value" };

  it("accepts a valid token and returns sub, email and name", async () => {
    const result = await verifyIdToken(await sign(base()), expected, jwks);
    expect(result).toEqual({ ok: true, claims: { sub: "1234567890", email: "a@example.com", name: "Test User", nonce: "expected-nonce-value" } });
  });

  it("accepts the issuer without https://", async () => {
    expect((await verifyIdToken(await sign({ ...base(), iss: "accounts.google.com" }), expected, jwks)).ok).toBe(true);
  });

  it("accepts a token without a name (BR-09)", async () => {
    const result = await verifyIdToken(await sign(omit(base(), "name")), expected, jwks);
    expect(result.ok && result.claims.name).toBeUndefined();
  });

  it.each([
    ["a bad signature (signed by another key)", async () => sign(base(), { key: otherKey })],
    ["the wrong issuer", async () => sign({ ...base(), iss: "https://evil.example" })],
    ["the wrong audience", async () => sign({ ...base(), aud: "other-client.apps.googleusercontent.com" })],
    ["an expired token", async () => sign({ ...base(), exp: now() - 60 })],
    ["a missing nonce", async () => sign(omit(base(), "nonce"))],
    ["a malformed token", async () => "not.a.jwt"],
  ])("rejects %s", async (_label, makeToken) => {
    const result = await verifyIdToken(await makeToken(), expected, jwks);
    expect(result.ok).toBe(false);
  });

  it("rejects a nonce that does not match the cookie", async () => {
    const result = await verifyIdToken(await sign({ ...base(), nonce: "other-nonce" }), expected, jwks);
    expect(result).toEqual({ ok: false, reason: "nonce_mismatch" });
  });

  it("rejects a token with no usable email", async () => {
    expect(await verifyIdToken(await sign(omit(base(), "email")), expected, jwks)).toEqual({ ok: false, reason: "invalid_claims" });
  });
});

describe("exchangeCode (steps 7–8)", () => {
  const good = { access_token: "ya29.synthetic", expires_in: 3599, token_type: "Bearer", scope: `openid ${DRIVE}`, id_token: "x.y.z", refresh_token: "1//r" };

  it("POSTs the code, verifier and client secret to Google's token endpoint", async () => {
    fetchMock.mockResolvedValue(json(200, good));
    const result = await exchangeCode(CONFIG, "auth-code", "verifier-value");
    expect(result).toEqual({ ok: true, tokens: good });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      code_verifier: "verifier-value",
      client_id: CLIENT_ID,
      client_secret: "test-client-secret",
      redirect_uri: CONFIG.redirectUri,
    });
  });

  it.each([
    ["Google rejects the code", () => fetchMock.mockResolvedValue(json(400, { error: "invalid_grant" })), "rejected"],
    ["the request times out", () => fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError")), "request_failed"],
    ["the response has no id_token", () => fetchMock.mockResolvedValue(json(200, { ...good, id_token: undefined })), "invalid_response"],
    ["the token type is wrong", () => fetchMock.mockResolvedValue(json(200, { ...good, token_type: "mac" })), "invalid_response"],
    ["the body is not JSON", () => fetchMock.mockResolvedValue(new Response("<html>", { status: 200 })), "invalid_response"],
  ])("fails safely when %s", async (_label, arrange, reason) => {
    arrange();
    expect(await exchangeCode(CONFIG, "auth-code", "verifier")).toEqual({ ok: false, reason });
  });
});

describe("refreshAccessToken (section 4.3)", () => {
  it("returns only the access token", async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: "ya29.new", expires_in: 3599, token_type: "Bearer" }));
    expect(await refreshAccessToken(CONFIG, "1//r")).toEqual({ ok: true, accessToken: "ya29.new" });
    expect(Object.fromEntries(fetchMock.mock.calls[0][1].body as URLSearchParams)).toMatchObject({ grant_type: "refresh_token", refresh_token: "1//r" });
  });

  it("reports invalid_grant (expired or revoked)", async () => {
    fetchMock.mockResolvedValue(json(400, { error: "invalid_grant" }));
    expect(await refreshAccessToken(CONFIG, "1//r")).toEqual({ ok: false, reason: "invalid_grant" });
  });

  it.each([
    ["a 500", () => fetchMock.mockResolvedValue(json(500, { error: "internal" }))],
    ["a timeout", () => fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"))],
    ["an invalid body", () => fetchMock.mockResolvedValue(json(200, { nope: true }))],
    ["another OAuth error", () => fetchMock.mockResolvedValue(json(401, { error: "invalid_client" }))],
  ])("treats %s as temporary", async (_label, arrange) => {
    arrange();
    expect(await refreshAccessToken(CONFIG, "1//r")).toEqual({ ok: false, reason: "temporary" });
  });
});

describe("revokeToken (FR-10)", () => {
  it("POSTs the token to the revoke endpoint", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    expect(await revokeToken("1//r")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ token: "1//r" });
  });

  it.each([
    ["Google returns 400", () => fetchMock.mockResolvedValue(new Response("", { status: 400 }))],
    ["the request fails", () => fetchMock.mockRejectedValue(new TypeError("network"))],
  ])("returns false when %s", async (_label, arrange) => {
    arrange();
    expect(await revokeToken("1//r")).toBe(false);
  });
});
