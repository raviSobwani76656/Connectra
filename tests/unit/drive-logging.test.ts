import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));

const { classifyDriveError, driveErrorReasons, listRecentFiles } = await import("@/lib/google/drive");
const { safeLogCode } = await import("@/lib/auth/dev-log");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  fetchMock.mockReset();
  warn.mockRestore();
  vi.unstubAllEnvs();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Shapes taken from Google's error responses: classic `errors[].reason` and newer `details[].reason`.
const NOT_CONFIGURED_CLASSIC = {
  error: {
    code: 403,
    message: "Google Drive API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/...",
    errors: [{ message: "Google Drive API has not been used...", domain: "usageLimits", reason: "accessNotConfigured" }],
  },
};
const SERVICE_DISABLED_MODERN = {
  error: { code: 403, status: "PERMISSION_DENIED", message: "API disabled", details: [{ reason: "SERVICE_DISABLED", domain: "googleapis.com" }] },
};

describe("Drive configuration errors (D-022)", () => {
  it.each([
    ["classic accessNotConfigured", NOT_CONFIGURED_CLASSIC],
    ["modern SERVICE_DISABLED", SERVICE_DISABLED_MODERN],
  ])("403 %s is not_configured", (_label, body) => {
    expect(classifyDriveError(403, body)).toBe("not_configured");
  });

  it("is reported by listRecentFiles", async () => {
    fetchMock.mockResolvedValue(json(403, NOT_CONFIGURED_CLASSIC));
    expect(await listRecentFiles("t")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("logs the reason and a hint to enable the Drive API in development", async () => {
    fetchMock.mockResolvedValue(json(403, NOT_CONFIGURED_CLASSIC));
    await listRecentFiles("t");
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain("kind=not_configured status=403 reason=accessNotConfigured");
    expect(line).toContain("hint=enable the Google Drive API");
  });
});

describe("Drive error logging contents", () => {
  it.each([
    ["insufficientPermissions", { error: { code: 403, errors: [{ reason: "insufficientPermissions", message: "Insufficient Permission" }] } }, "kind=insufficient_scope status=403 reason=insufficientPermissions"],
    ["rateLimitExceeded", { error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } }, "kind=temporary status=403 reason=rateLimitExceeded"],
    ["429 without a body", {}, "kind=temporary status=429 reason=none"],
  ])("logs the reason for %s", async (_label, body, expected) => {
    fetchMock.mockResolvedValue(json(_label.startsWith("429") ? 429 : 403, body));
    await listRecentFiles("t");
    expect(String(warn.mock.calls[0][0])).toContain(expected);
  });

  it("never logs Google's message text, the access token or anything outside the safe code pattern", async () => {
    fetchMock.mockResolvedValue(
      json(403, {
        error: {
          code: 403,
          message: "secret message about file Quarterly Report.xlsx for a@example.com",
          errors: [{ reason: "weird reason with spaces a@example.com" }, { reason: "insufficientPermissions" }],
        },
      }),
    );
    await listRecentFiles("ya29.SECRET-ACCESS-TOKEN");
    const line = String(warn.mock.calls[0][0]);
    expect(line).not.toMatch(/secret message|Quarterly|a@example\.com|ya29|weird/);
    expect(line).toContain("reason=insufficientPermissions");
  });

  it("logs nothing outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValue(json(403, NOT_CONFIGURED_CLASSIC));
    await listRecentFiles("t");
    expect(warn).not.toHaveBeenCalled();
  });

  it("extracts only identifier-like reasons", () => {
    expect(driveErrorReasons({ error: { errors: [{ reason: "ok_Reason1" }, { reason: "<script>" }, { reason: "" }] } })).toEqual(["ok_Reason1"]);
    expect(driveErrorReasons("not an object")).toEqual([]);
  });
});

describe("safeLogCode", () => {
  it.each([
    ["invalid_grant", "invalid_grant"],
    ["PGRST205", "PGRST205"],
    ["ERR_JWT_EXPIRED", "ERR_JWT_EXPIRED"],
    [429, "429"],
    [undefined, "none"],
    ["", "none"],
    ["has spaces", "unrecognised"],
    ["a@example.com", "unrecognised"],
    ["x".repeat(65), "unrecognised"],
  ])("%s -> %s", (input, expected) => {
    expect(safeLogCode(input)).toBe(expected);
  });
});
