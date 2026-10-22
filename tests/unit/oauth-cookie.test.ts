import { describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));

const { openOAuthFlow, sealOAuthFlow } = await import("@/lib/google/oauth-cookie");

const NOW = 1_800_000_000_000;
const FLOW = {
  state: "s".repeat(43),
  nonce: "n".repeat(43),
  codeVerifier: "v".repeat(64),
  userId: "user-a",
  issuedAt: NOW,
};

describe("OAuth flow cookie (D-020)", () => {
  it("round-trips for the same user", () => {
    expect(openOAuthFlow(sealOAuthFlow(FLOW), "user-a", NOW + 1000)).toEqual(FLOW);
  });

  it("hides the code verifier, state and nonce", () => {
    const sealed = sealOAuthFlow(FLOW);
    expect(sealed.startsWith("v1.")).toBe(true);
    for (const secret of [FLOW.codeVerifier, FLOW.state, FLOW.nonce, FLOW.userId]) {
      expect(sealed).not.toContain(secret);
    }
  });

  it("rejects a cookie created for another user", () => {
    expect(openOAuthFlow(sealOAuthFlow(FLOW), "user-b", NOW)).toBeNull();
  });

  it("rejects a cookie older than 10 minutes", () => {
    const sealed = sealOAuthFlow(FLOW);
    expect(openOAuthFlow(sealed, "user-a", NOW + 10 * 60 * 1000)).not.toBeNull();
    expect(openOAuthFlow(sealed, "user-a", NOW + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("rejects a cookie issued in the future", () => {
    expect(openOAuthFlow(sealOAuthFlow({ ...FLOW, issuedAt: NOW + 5 * 60 * 1000 }), "user-a", NOW)).toBeNull();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not encrypted", JSON.stringify(FLOW)],
    ["oversized", "v1." + "A".repeat(5000)],
  ])("rejects a %s cookie", (_label, value) => {
    expect(openOAuthFlow(value, "user-a", NOW)).toBeNull();
  });

  it("rejects a tampered cookie", () => {
    const sealed = sealOAuthFlow(FLOW);
    const last = sealed.at(-1) === "A" ? "B" : "A";
    expect(openOAuthFlow(sealed.slice(0, -1) + last, "user-a", NOW)).toBeNull();
  });
});
