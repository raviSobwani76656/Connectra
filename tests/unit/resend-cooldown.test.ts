import { describe, expect, it } from "vitest";
import { RESEND_COOLDOWN_SECONDS, secondsUntilResendAllowed } from "@/lib/auth/resend-cooldown";

const SENT = 1_000_000;

describe("secondsUntilResendAllowed (FR-13, AC-13.1)", () => {
  it("uses a 60-second cooldown", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it.each([
    ["never sent", undefined, 0],
    ["no timestamp", null, 0],
    ["not a number", Number.NaN, 0],
  ])("allows a resend when %s", (_label, lastSentAt, expected) => {
    expect(secondsUntilResendAllowed(lastSentAt, SENT)).toBe(expected);
  });

  it.each([
    ["immediately after sending", 0, 60],
    ["after 0.9 s", 900, 60],
    ["after 1 s", 1_000, 59],
    ["after 59 s", 59_000, 1],
    ["after 59.999 s", 59_999, 1],
    ["after exactly 60 s", 60_000, 0],
    ["after 61 s", 61_000, 0],
  ])("%s", (_label, elapsedMs, expected) => {
    expect(secondsUntilResendAllowed(SENT, SENT + elapsedMs)).toBe(expected);
  });

  it("treats a timestamp in the future as just sent", () => {
    expect(secondsUntilResendAllowed(SENT + 5_000, SENT)).toBe(60);
  });

  it("supports a custom cooldown", () => {
    expect(secondsUntilResendAllowed(SENT, SENT + 10_000, 30)).toBe(20);
  });
});
