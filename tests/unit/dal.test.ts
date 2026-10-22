import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only the boundaries: the Supabase client factory and Next's redirect().
const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

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

const { getCurrentUser, requireUser } = await import("@/lib/auth/dal");

beforeEach(() => {
  getClaims.mockReset();
});

describe("getCurrentUser", () => {
  it("returns the verified user id and email", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-a", email: "a@example.com" } },
      error: null,
    });
    await expect(getCurrentUser()).resolves.toEqual({ id: "user-a", email: "a@example.com" });
  });

  it("returns null when there is no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when verification fails, even if claims are present", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-a" } },
      error: new Error("invalid JWT"),
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when the subject is missing or not a string", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 123 } }, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("requireUser (FR-04, SR-02)", () => {
  it("returns the user when signed in", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    await expect(requireUser()).resolves.toEqual({ id: "user-a", email: null });
  });

  it("redirects to /login when signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(requireUser()).rejects.toMatchObject({ url: "/login" });
  });

  it("redirects to /login when the session cannot be verified", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("expired") });
    await expect(requireUser()).rejects.toMatchObject({ url: "/login" });
  });
});
