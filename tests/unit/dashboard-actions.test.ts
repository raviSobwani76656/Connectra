import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, RedirectSignal, redirectOf, TEST_ENV } from "../helpers/test-env";

const cookies = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createCookieJar> }));
const mocks = vi.hoisted(() => ({
  readRefreshToken: vi.fn(),
  deleteGoogleConnection: vi.fn(),
  revokeToken: vi.fn(),
  verifyPassword: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));
vi.mock("next/headers", () => ({ cookies: async () => cookies.current.store }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));
vi.mock("@/lib/auth/dal", () => ({ requireUser: async () => ({ id: "user-a", email: "a@example.com" }) }));
vi.mock("@/lib/google/connection", () => ({
  readRefreshToken: mocks.readRefreshToken,
  deleteGoogleConnection: mocks.deleteGoogleConnection,
}));
vi.mock("@/lib/google/oauth", () => ({ revokeToken: mocks.revokeToken }));
vi.mock("@/lib/supabase/password-check", () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: mocks.deleteUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut: mocks.signOut } }) }));

const { deleteAccount, disconnectGoogle } = await import("@/app/dashboard/actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  cookies.current = createCookieJar();
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.deleteGoogleConnection.mockResolvedValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
});

describe("disconnectGoogle (FR-10, section 5)", () => {
  it("revokes, deletes the row and reports success", async () => {
    mocks.readRefreshToken.mockResolvedValue("1//refresh");
    mocks.revokeToken.mockResolvedValue(true);
    expect(await redirectOf(() => disconnectGoogle())).toBe("/dashboard?message=google-disconnected");
    expect(mocks.revokeToken).toHaveBeenCalledWith("1//refresh");
    expect(mocks.deleteGoogleConnection).toHaveBeenCalledTimes(1);
  });

  it("still deletes the row when revoking fails (BR-10)", async () => {
    mocks.readRefreshToken.mockResolvedValue("1//refresh");
    mocks.revokeToken.mockResolvedValue(false);
    expect(await redirectOf(() => disconnectGoogle())).toBe("/dashboard?message=google-disconnected-unconfirmed");
    expect(mocks.deleteGoogleConnection).toHaveBeenCalledTimes(1);
  });

  it("still deletes the row when the stored token cannot be read", async () => {
    mocks.readRefreshToken.mockResolvedValue(null);
    expect(await redirectOf(() => disconnectGoogle())).toBe("/dashboard?message=google-disconnected");
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.deleteGoogleConnection).toHaveBeenCalledTimes(1);
  });

  it("reports a database failure", async () => {
    mocks.readRefreshToken.mockResolvedValue(null);
    mocks.deleteGoogleConnection.mockResolvedValue(false);
    expect(await redirectOf(() => disconnectGoogle())).toBe("/dashboard?message=google-error");
  });
});

describe("deleteAccount (FR-11, section 6)", () => {
  const valid = { password: "correct-horse-battery", confirmation: "DELETE" };

  it.each([
    ["missing", {}],
    ["lower case", { confirmation: "delete" }],
    ["with spaces", { confirmation: " DELETE " }],
    ["other text", { confirmation: "yes" }],
  ])("requires the exact word DELETE (%s)", async (_label, override) => {
    const result = await deleteAccount({}, form({ password: valid.password, ...override }));
    expect(result.fieldErrors?.confirmation).toBe("Type DELETE in capital letters to confirm.");
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("requires a password", async () => {
    const result = await deleteAccount({}, form({ confirmation: "DELETE" }));
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("a wrong password stops deletion", async () => {
    mocks.verifyPassword.mockResolvedValue("wrong");
    expect(await deleteAccount({}, form(valid))).toEqual({ fieldErrors: { password: "Incorrect password." } });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("user-a", "a@example.com", valid.password);
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("respects rate limits with a friendly message", async () => {
    mocks.verifyPassword.mockResolvedValue("rate_limited");
    expect((await deleteAccount({}, form(valid))).formError).toBe("Too many attempts. Please wait a minute and try again.");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("success: revokes Google, deletes the user with the admin client, clears cookies, redirects", async () => {
    mocks.verifyPassword.mockResolvedValue("ok");
    mocks.readRefreshToken.mockResolvedValue("1//refresh");
    mocks.revokeToken.mockResolvedValue(true);
    cookies.current.jar.set("sb-project-auth-token", { value: "x" });
    cookies.current.jar.set("sb-project-auth-token.0", { value: "y" });
    cookies.current.jar.set("unrelated", { value: "z" });

    expect(await redirectOf(() => deleteAccount({}, form(valid)))).toBe("/login?notice=account-deleted");
    expect(mocks.revokeToken).toHaveBeenCalledWith("1//refresh");
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-a");
    expect(mocks.signOut).toHaveBeenCalled();
    expect([...cookies.current.jar.keys()]).toEqual(["unrelated"]);
    // The row is removed by ON DELETE CASCADE, not by the action.
    expect(mocks.deleteGoogleConnection).not.toHaveBeenCalled();
  });

  it("still deletes the account when there is no Google connection or revoke fails", async () => {
    mocks.verifyPassword.mockResolvedValue("ok");
    mocks.readRefreshToken.mockResolvedValue("1//refresh");
    mocks.revokeToken.mockResolvedValue(false);
    expect(await redirectOf(() => deleteAccount({}, form(valid)))).toBe("/login?notice=account-deleted");
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-a");
  });

  it("keeps the user signed in and shows an error if the admin delete fails", async () => {
    mocks.verifyPassword.mockResolvedValue("ok");
    mocks.readRefreshToken.mockResolvedValue(null);
    mocks.deleteUser.mockResolvedValue({ data: null, error: { code: "unexpected_failure", status: 500 } });
    expect((await deleteAccount({}, form(valid))).formError).toBe("Could not delete your account. Please try again.");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
