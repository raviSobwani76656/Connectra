import { describe, expect, it } from "vitest";
import { DASHBOARD_MESSAGES, dashboardMessageFor, dashboardUrl } from "@/lib/dashboard/messages";
import { loginNoticeSchema } from "@/lib/auth/schemas";

describe("dashboard message codes (D-021)", () => {
  it.each(Object.keys(DASHBOARD_MESSAGES))("maps %s to its fixed text", (code) => {
    expect(dashboardMessageFor(code)).toBe(DASHBOARD_MESSAGES[code as keyof typeof DASHBOARD_MESSAGES]);
  });

  it("has exactly the six messages from the spec", () => {
    expect(Object.values(DASHBOARD_MESSAGES).map((m) => m.text)).toEqual([
      "Google Drive connected.",
      "Google Drive disconnected.",
      "Disconnected here, but we couldn't confirm with Google. You can remove access at myaccount.google.com/permissions.",
      "Connection cancelled. Google Drive was not connected.",
      "Google Drive access wasn't fully granted. Please reconnect and allow access to your Drive files.",
      "Something went wrong connecting Google Drive. Please try again.",
    ]);
  });

  it.each([
    ["unknown code", "google-hacked"],
    ["HTML", "<script>alert(1)</script>"],
    ["free text", "Your account was hacked, call this number"],
    ["array (repeated parameter)", ["google-connected", "google-error"]],
    ["missing", undefined],
    ["empty", ""],
    ["case changed", "GOOGLE-CONNECTED"],
  ])("ignores %s", (_label, value) => {
    expect(dashboardMessageFor(value)).toBeNull();
  });

  it("builds internal dashboard URLs only", () => {
    expect(dashboardUrl("google-connected")).toBe("/dashboard?message=google-connected");
  });

  it("knows the account-deleted login notice", () => {
    expect(loginNoticeSchema.safeParse("account-deleted").success).toBe(true);
  });
});
