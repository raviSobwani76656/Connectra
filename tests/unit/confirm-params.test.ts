import { describe, expect, it } from "vitest";
import {
  confirmErrorReasonSchema,
  confirmParamsSchema,
  loginNoticeSchema,
  resendSchema,
} from "@/lib/auth/schemas";

// Synthetic, hex-like token hash (not a real token).
const TOKEN = "a".repeat(56);

describe("confirmParamsSchema (FR-12, SR-09, D-017)", () => {
  it.each(["email", "signup"])("accepts type=%s", (type) => {
    expect(confirmParamsSchema.safeParse({ token_hash: TOKEN, type }).success).toBe(true);
  });

  it("accepts URL-safe token hashes such as a pkce_ prefix", () => {
    expect(confirmParamsSchema.safeParse({ token_hash: `pkce_${TOKEN}`, type: "email" }).success).toBe(true);
  });

  it.each([
    ["recovery", "recovery"],
    ["magiclink", "magiclink"],
    ["email_change", "email_change"],
    ["invite", "invite"],
    ["empty", ""],
    ["missing", null],
    ["upper case", "EMAIL"],
  ])("rejects type: %s", (_label, type) => {
    expect(confirmParamsSchema.safeParse({ token_hash: TOKEN, type }).success).toBe(false);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["too short (7)", "a".repeat(7)],
    ["too long (513)", "a".repeat(513)],
    ["with spaces", `${TOKEN} x`],
    ["with a slash", `${TOKEN}/x`],
    ["with HTML", "<script>alert(1)</script>"],
    ["URL-encoded junk", "%3Cscript%3E"],
  ])("rejects token_hash: %s", (_label, token_hash) => {
    expect(confirmParamsSchema.safeParse({ token_hash, type: "email" }).success).toBe(false);
  });

  it("accepts the boundary lengths 8 and 512", () => {
    expect(confirmParamsSchema.safeParse({ token_hash: "a".repeat(8), type: "email" }).success).toBe(true);
    expect(confirmParamsSchema.safeParse({ token_hash: "a".repeat(512), type: "email" }).success).toBe(true);
  });

  it("drops unexpected parameters such as a redirect target", () => {
    const parsed = confirmParamsSchema.parse({
      token_hash: TOKEN,
      type: "email",
      next: "https://evil.example",
    });
    expect(parsed).toEqual({ token_hash: TOKEN, type: "email" });
  });
});

describe("fixed notice and reason values", () => {
  it("accepts only the known login notice", () => {
    expect(loginNoticeSchema.safeParse("email-confirmed").success).toBe(true);
    expect(loginNoticeSchema.safeParse("<b>hi</b>").success).toBe(false);
    expect(loginNoticeSchema.safeParse(["email-confirmed", "x"]).success).toBe(false);
    expect(loginNoticeSchema.safeParse(undefined).success).toBe(false);
  });

  it("accepts only the known error reasons", () => {
    expect(confirmErrorReasonSchema.safeParse("expired").success).toBe(true);
    expect(confirmErrorReasonSchema.safeParse("invalid").success).toBe(true);
    expect(confirmErrorReasonSchema.safeParse("anything else").success).toBe(false);
  });
});

describe("resendSchema", () => {
  it("normalises the email", () => {
    expect(resendSchema.parse({ email: " A@Example.com " })).toEqual({ email: "a@example.com" });
  });

  it.each([null, "", "not-an-email"])("rejects %s", (email) => {
    expect(resendSchema.safeParse({ email }).success).toBe(false);
  });
});
