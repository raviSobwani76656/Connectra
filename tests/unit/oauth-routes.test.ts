import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, omit, RedirectSignal, redirectOf, TEST_ENV } from "../helpers/test-env";

const cookies = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createCookieJar> }));
const auth = vi.hoisted(() => ({ user: { id: "user-a", email: "a@example.com" } as { id: string; email: string } | null }));
const google = vi.hoisted(() => ({ exchangeCode: vi.fn(), verifyIdToken: vi.fn(), save: vi.fn() }));

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));
vi.mock("next/headers", () => ({ cookies: async () => cookies.current.store }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));
vi.mock("@/lib/auth/dal", () => ({
  getCurrentUser: async () => auth.user,
  requireUser: async () => {
    if (!auth.user) throw new RedirectSignal("/login");
    return auth.user;
  },
}));
vi.mock("@/lib/google/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/oauth")>()),
  exchangeCode: google.exchangeCode,
  verifyIdToken: google.verifyIdToken,
}));
vi.mock("@/lib/google/connection", () => ({ saveGoogleConnection: google.save }));

const { GET: start } = await import("@/app/api/oauth/google/start/route");
const { GET: callback } = await import("@/app/api/oauth/google/callback/route");
const { openOAuthFlow, sealOAuthFlow } = await import("@/lib/google/oauth-cookie");
const { pkceChallenge } = await import("@/lib/google/oauth");

const COOKIE = "cx_google_oauth";
const DRIVE = "https://www.googleapis.com/auth/drive.metadata.readonly";
const STATE = "s".repeat(43);
const FLOW = { state: STATE, nonce: "n".repeat(43), codeVerifier: "v".repeat(64), userId: "user-a", issuedAt: Date.now() };
const TOKENS = { access_token: "ya29", expires_in: 3599, token_type: "Bearer", scope: `openid email profile ${DRIVE}`, id_token: "x.y.z", refresh_token: "1//refresh" };

beforeEach(() => {
  cookies.current = createCookieJar();
  auth.user = { id: "user-a", email: "a@example.com" };
  google.exchangeCode.mockReset().mockResolvedValue({ ok: true, tokens: TOKENS });
  google.verifyIdToken.mockReset().mockResolvedValue({ ok: true, claims: { sub: "g-1", email: "g@example.com", name: "Google Name", nonce: FLOW.nonce } });
  google.save.mockReset().mockResolvedValue(true);
});

describe("GET /api/oauth/google/start (spec section 2)", () => {
  it("requires login", async () => {
    auth.user = null;
    expect(await redirectOf(() => start())).toBe("/login");
    expect(cookies.current.jar.has(COOKIE)).toBe(false);
  });

  it("sets the sealed, short-lived, path-limited cookie", async () => {
    await redirectOf(() => start());
    const cookie = cookies.current.jar.get(COOKIE)!;
    expect(cookie.options).toEqual({ httpOnly: true, sameSite: "lax", path: "/api/oauth/google", maxAge: 600, secure: false });
    expect(cookie.value.startsWith("v1.")).toBe(true);
  });

  it("redirects to Google with state, nonce and an S256 challenge matching the cookie", async () => {
    const target = new URL(await redirectOf(() => start()));
    const flow = openOAuthFlow(cookies.current.jar.get(COOKIE)!.value, "user-a", Date.now())!;
    expect(target.origin).toBe("https://accounts.google.com");
    expect(target.searchParams.get("state")).toBe(flow.state);
    expect(target.searchParams.get("nonce")).toBe(flow.nonce);
    expect(target.searchParams.get("code_challenge")).toBe(pkceChallenge(flow.codeVerifier));
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/oauth/google/callback");
    expect(target.searchParams.get("scope")).toBe(`openid email profile ${DRIVE}`);
    expect(target.searchParams.get("access_type")).toBe("offline");
    expect(target.searchParams.get("prompt")).toBe("consent");
    expect(target.searchParams.get("include_granted_scopes")).toBe("false");
    expect(flow.state).not.toBe(flow.nonce);
    expect(flow.codeVerifier).toHaveLength(64);
  });

  it("generates new values every time", async () => {
    const first = new URL(await redirectOf(() => start())).searchParams.get("state");
    const second = new URL(await redirectOf(() => start())).searchParams.get("state");
    expect(first).not.toBe(second);
  });
});

function run(query: string, flow: typeof FLOW | null = FLOW) {
  if (flow) cookies.current.jar.set(COOKIE, { value: sealOAuthFlow(flow) });
  return redirectOf(() => callback(new NextRequest(`http://localhost:3000/api/oauth/google/callback${query}`)));
}

const OK_QUERY = `?code=4/auth-code&state=${STATE}&scope=openid`;

function expectNothingStoredAndCookieCleared() {
  expect(google.save).not.toHaveBeenCalled();
  const cookie = cookies.current.jar.get(COOKIE);
  expect(cookie?.value).toBe("");
  expect(cookie?.options).toMatchObject({ path: "/api/oauth/google", maxAge: 0 });
}

describe("GET /api/oauth/google/callback (spec section 3)", () => {
  it("success: stores the verified values and shows 'connected'", async () => {
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-connected");
    expect(google.exchangeCode).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: TEST_ENV.GOOGLE_CLIENT_ID, redirectUri: "http://localhost:3000/api/oauth/google/callback" }),
      "4/auth-code",
      FLOW.codeVerifier,
    );
    expect(google.verifyIdToken).toHaveBeenCalledWith("x.y.z", { clientId: TEST_ENV.GOOGLE_CLIENT_ID, nonce: FLOW.nonce });
    expect(google.save).toHaveBeenCalledWith({ refreshToken: "1//refresh", email: "g@example.com", name: "Google Name" });
    expect(cookies.current.jar.get(COOKIE)?.value).toBe("");
  });

  it("not logged in: goes to /login and stores nothing", async () => {
    auth.user = null;
    expect(await run(OK_QUERY)).toBe("/login");
    expectNothingStoredAndCookieCleared();
  });

  it("access_denied: 'cancelled'", async () => {
    expect(await run(`?error=access_denied&state=${STATE}`)).toBe("/dashboard?message=google-cancelled");
    expectNothingStoredAndCookieCleared();
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it("any other Google error: generic error", async () => {
    expect(await run(`?error=server_error&state=${STATE}`)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it.each([
    ["no parameters", ""],
    ["missing state", "?code=abc"],
    ["missing code", `?state=${STATE}`],
    ["state too short", "?code=abc&state=short"],
    ["state with bad characters", `?code=abc&state=${"%3C".repeat(20)}`],
    ["oversized code", `?code=${"a".repeat(3000)}&state=${STATE}`],
    ["error with bad characters", "?error=%3Cscript%3E"],
  ])("invalid query (%s): generic error", async (_label, query) => {
    expect(await run(query)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it("missing cookie: generic error", async () => {
    expect(await run(OK_QUERY, null)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it("expired cookie: generic error", async () => {
    expect(await run(OK_QUERY, { ...FLOW, issuedAt: Date.now() - 11 * 60 * 1000 })).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it("cookie for a different user: generic error", async () => {
    expect(await run(OK_QUERY, { ...FLOW, userId: "user-b" })).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it("state mismatch: generic error, code never exchanged", async () => {
    expect(await run(`?code=4/auth-code&state=${"t".repeat(43)}`)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it("invalid token response: generic error", async () => {
    google.exchangeCode.mockResolvedValue({ ok: false, reason: "invalid_response" });
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it.each(["invalid_token", "invalid_claims", "nonce_mismatch"])("ID token failure (%s): generic error", async (reason) => {
    google.verifyIdToken.mockResolvedValue({ ok: false, reason });
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it("Drive scope not granted: 'not fully granted'", async () => {
    google.exchangeCode.mockResolvedValue({ ok: true, tokens: { ...TOKENS, scope: "openid email profile" } });
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-insufficient-scope");
    expectNothingStoredAndCookieCleared();
  });

  it("missing refresh token: generic error", async () => {
    google.exchangeCode.mockResolvedValue({ ok: true, tokens: omit(TOKENS, "refresh_token") });
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-error");
    expectNothingStoredAndCookieCleared();
  });

  it("database failure: generic error", async () => {
    google.save.mockResolvedValue(false);
    expect(await run(OK_QUERY)).toBe("/dashboard?message=google-error");
  });

  it("stores no name when Google gave none", async () => {
    google.verifyIdToken.mockResolvedValue({ ok: true, claims: { sub: "g-1", email: "g@example.com", nonce: FLOW.nonce } });
    await run(OK_QUERY);
    expect(google.save).toHaveBeenCalledWith({ refreshToken: "1//refresh", email: "g@example.com", name: null });
  });

  it("never redirects outside the app", async () => {
    const target = await run(`${OK_QUERY}&next=https://evil.example&redirect_uri=https://evil.example`);
    expect(target.startsWith("/dashboard")).toBe(true);
  });
});
