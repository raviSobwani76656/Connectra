import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp } }) }));

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

const { GET } = await import("@/app/(auth)/auth/confirm/route");

const TOKEN = "b".repeat(56); // synthetic

function request(query: string) {
  return new NextRequest(`http://localhost:3000/auth/confirm${query}`);
}

async function redirectOf(query: string): Promise<string> {
  try {
    await GET(request(query));
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  verifyOtp.mockReset();
});

describe("GET /auth/confirm (FR-12, D-017)", () => {
  it("verifies the token hash and goes to the dashboard when a session is created (AC-12.3)", async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" }, user: {} }, error: null });
    expect(await redirectOf(`?token_hash=${TOKEN}&type=email`)).toBe("/dashboard");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: TOKEN });
  });

  it("goes to log in with the confirmed notice when no session is created", async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    expect(await redirectOf(`?token_hash=${TOKEN}&type=signup`)).toBe("/login?notice=email-confirmed");
  });

  it("reports an expired link (AC-12.4)", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: Object.assign(new Error("expired"), { code: "otp_expired", status: 403 }),
    });
    expect(await redirectOf(`?token_hash=${TOKEN}&type=email`)).toBe("/auth/confirm/error?reason=expired");
  });

  it("reports any other verification failure as invalid", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: Object.assign(new Error("bad"), { code: "validation_failed", status: 400 }),
    });
    expect(await redirectOf(`?token_hash=${TOKEN}&type=email`)).toBe("/auth/confirm/error?reason=invalid");
  });

  it.each([
    ["no parameters", ""],
    ["missing type", `?token_hash=${TOKEN}`],
    ["missing token_hash", "?type=email"],
    ["unsupported type", `?token_hash=${TOKEN}&type=recovery`],
    ["malformed token_hash", "?token_hash=%3Cscript%3E&type=email"],
  ])("rejects %s without calling Supabase", async (_label, query) => {
    expect(await redirectOf(query)).toBe("/auth/confirm/error?reason=invalid");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("ignores a next/redirect parameter (no open redirect, SEC-032)", async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
    const target = await redirectOf(
      `?token_hash=${TOKEN}&type=email&next=https://evil.example&redirect_to=https://evil.example`,
    );
    expect(target).toBe("/dashboard");
  });
});
