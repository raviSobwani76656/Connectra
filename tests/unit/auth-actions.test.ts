import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundaries only: Supabase client, Next's redirect() and the cookie store.
const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

const cookieJar = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, { value, options });
    },
  }),
}));

const { logIn, resendConfirmation, signUp } = await import("@/app/(auth)/actions");

const PASSWORD = "correct-horse-battery";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function apiError(code: string, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.resend.mockReset();
  cookieJar.clear();
  vi.useRealTimers();
});

describe("signUp (FR-01, FR-12)", () => {
  it("goes to the dashboard when Supabase returns a session (confirmation off)", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "x" }, user: {} }, error: null });
    await expect(signUp({}, form({ email: "new@example.com", password: PASSWORD }))).rejects.toMatchObject({
      url: "/dashboard",
    });
  });

  it("shows the check-email screen when there is no session (confirmation on, AC-12.1)", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    await expect(signUp({}, form({ email: "New@Example.com", password: PASSWORD }))).resolves.toEqual({
      status: "check-email",
      email: "new@example.com",
    });
  });

  it("shows the same screen for an existing email when Supabase hides it (AC-12.2, BR-12)", async () => {
    // With confirmation on, Supabase returns a user without identities and no session.
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u2", identities: [] } }, error: null });
    const result = await signUp({}, form({ email: "taken@example.com", password: PASSWORD }));
    expect(result).toEqual({ status: "check-email", email: "taken@example.com" });
    expect(result).not.toHaveProperty("formError");
  });

  it("keeps the existing-account message when confirmation is off (L-02)", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: apiError("user_already_exists", 422) });
    const result = await signUp({}, form({ email: "taken@example.com", password: PASSWORD }));
    expect(result.formError).toBe("An account with this email already exists. Log in instead.");
    expect(result.status).toBeUndefined();
  });

  it("explains an email sending limit without claiming an email was sent", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: apiError("over_email_send_rate_limit", 429) });
    const result = await signUp({}, form({ email: "new@example.com", password: PASSWORD }));
    expect(result.formError).toMatch(/email limit was reached/);
    expect(result.status).toBeUndefined();
  });

  it("does not call Supabase when validation fails", async () => {
    const result = await signUp({}, form({ email: "bad", password: "short" }));
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("never echoes the password", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    const result = await signUp({}, form({ email: "new@example.com", password: PASSWORD }));
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });
});

describe("logIn (FR-02, D-018)", () => {
  it("asks an unconfirmed user to confirm their email (AC-12.5)", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: apiError("email_not_confirmed") });
    await expect(logIn({}, form({ email: "u@example.com", password: PASSWORD }))).resolves.toEqual({
      status: "needs-confirmation",
      formError: "Please confirm your email address first. Check your inbox for the confirmation link.",
      email: "u@example.com",
    });
  });

  it.each(["invalid_credentials", "user_not_found", "unexpected_failure"])(
    "keeps the generic message for %s (AC-2.2)",
    async (code) => {
      auth.signInWithPassword.mockResolvedValue({ data: {}, error: apiError(code) });
      const result = await logIn({}, form({ email: "u@example.com", password: PASSWORD }));
      expect(result.formError).toBe("Invalid email or password.");
      expect(result.status).toBeUndefined();
    },
  );

  it("goes to the dashboard on success", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(logIn({}, form({ email: "u@example.com", password: PASSWORD }))).rejects.toMatchObject({
      url: "/dashboard",
    });
  });
});

describe("resendConfirmation (FR-13)", () => {
  const SENT = "If an account needs confirming, we've sent a new link.";

  it("sends a signup confirmation for the normalised email", async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    const result = await resendConfirmation({}, form({ email: " U@Example.com " }));
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "u@example.com" });
    expect(result).toMatchObject({ tone: "info", message: SENT });
    expect(typeof result.sentAt).toBe("number");
  });

  it.each([
    ["the email exists", null],
    ["Supabase reports an unexpected error", apiError("unexpected_failure", 500)],
    ["the email is unknown or already confirmed", apiError("validation_failed", 400)],
  ])("shows the same message when %s (AC-13.2)", async (_label, error) => {
    auth.resend.mockResolvedValue({ data: {}, error });
    await expect(resendConfirmation({}, form({ email: "u@example.com" }))).resolves.toMatchObject({
      tone: "info",
      message: SENT,
    });
  });

  it.each(["over_email_send_rate_limit", "over_request_rate_limit"])(
    "shows a friendly wait message for %s (AC-13.3)",
    async (code) => {
      auth.resend.mockResolvedValue({ data: {}, error: apiError(code, 429) });
      const result = await resendConfirmation({}, form({ email: "u@example.com" }));
      expect(result.tone).toBe("error");
      expect(result.message).toMatch(/can't send another email right now/);
    },
  );

  it("blocks a second request within 60 seconds without calling Supabase again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await resendConfirmation({}, form({ email: "u@example.com" }));

    vi.setSystemTime(new Date("2026-10-22T10:00:30Z"));
    const second = await resendConfirmation({}, form({ email: "u@example.com" }));
    expect(second.message).toBe("Please wait 30 seconds before requesting another email.");
    expect(auth.resend).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-22T10:01:00Z"));
    await resendConfirmation({}, form({ email: "u@example.com" }));
    expect(auth.resend).toHaveBeenCalledTimes(2);
  });

  it("stores the cooldown in a short-lived httpOnly cookie that holds no email", async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await resendConfirmation({}, form({ email: "u@example.com" }));
    const cookie = cookieJar.get("cx_resend_at");
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 60 });
    expect(cookie?.value).toMatch(/^\d+$/);
  });

  it("rejects an invalid email without calling Supabase", async () => {
    const result = await resendConfirmation({}, form({ email: "nope" }));
    expect(result).toEqual({ tone: "error", message: "Enter a valid email address." });
    expect(auth.resend).not.toHaveBeenCalled();
  });
});
