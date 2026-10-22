import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));

const { classifyDriveError, listRecentFiles } = await import("@/lib/google/drive");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const FILE = {
  id: "file-1",
  name: "Quarterly report",
  mimeType: "application/vnd.google-apps.spreadsheet",
  modifiedTime: "2026-10-22T08:35:00.000Z",
  webViewLink: "https://docs.google.com/spreadsheets/d/file-1/edit",
};

describe("listRecentFiles request (D-019, section 4.4)", () => {
  it("asks Drive for the 20 newest non-trashed files with limited fields", async () => {
    fetchMock.mockResolvedValue(json(200, { files: [] }));
    await listRecentFiles("ya29.access");
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe("https://www.googleapis.com/drive/v3/files");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      q: "trashed = false",
      orderBy: "modifiedTime desc",
      pageSize: "20",
      corpora: "user",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    expect(u.searchParams.has("includeItemsFromAllDrives")).toBe(false);
    expect(init.headers.Authorization).toBe("Bearer ya29.access");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.cache).toBe("no-store");
  });

  it("makes exactly one call", async () => {
    fetchMock.mockResolvedValue(json(500, {}));
    await listRecentFiles("t");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("listRecentFiles response", () => {
  it("maps files to display values and ignores unknown fields", async () => {
    fetchMock.mockResolvedValue(json(200, { kind: "drive#fileList", files: [{ ...FILE, owners: [{ emailAddress: "x@y.z" }] }] }));
    expect(await listRecentFiles("t")).toEqual({
      ok: true,
      files: [
        {
          id: "file-1",
          name: "Quarterly report",
          typeLabel: "Google Sheets",
          modifiedLabel: "22 Oct 2026, 14:05",
          modifiedIso: "2026-10-22T08:35:00.000Z",
          link: "https://docs.google.com/spreadsheets/d/file-1/edit",
        },
      ],
    });
  });

  it("drops unsafe links but keeps the file", async () => {
    fetchMock.mockResolvedValue(json(200, { files: [{ ...FILE, webViewLink: "javascript:alert(1)" }] }));
    const result = await listRecentFiles("t");
    expect(result.ok && result.files[0].link).toBeNull();
  });

  it("returns an empty list for an empty Drive", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    expect(await listRecentFiles("t")).toEqual({ ok: true, files: [] });
  });

  it("never returns more than 20 files", async () => {
    const files = Array.from({ length: 25 }, (_, i) => ({ ...FILE, id: `f${i}` }));
    fetchMock.mockResolvedValue(json(200, { files }));
    const result = await listRecentFiles("t");
    expect(result.ok && result.files).toHaveLength(20);
  });

  it.each([
    ["files is not an array", { files: "nope" }],
    ["a file has no id", { files: [{ ...FILE, id: undefined }] }],
    ["a date is not ISO", { files: [{ ...FILE, modifiedTime: "yesterday" }] }],
    ["the body is not JSON", "not-json"],
  ])("treats an invalid response as temporary: %s", async (_label, body) => {
    fetchMock.mockResolvedValue(
      typeof body === "string" ? new Response(body, { status: 200 }) : json(200, body),
    );
    expect(await listRecentFiles("t")).toEqual({ ok: false, reason: "temporary" });
  });

  it("treats a timeout as temporary", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await listRecentFiles("t")).toEqual({ ok: false, reason: "temporary" });
  });
});

describe("classifyDriveError (D-019)", () => {
  const classic = (reason: string) => ({ error: { code: 403, errors: [{ reason }] } });
  const modern = (reason: string) => ({ error: { code: 403, status: "PERMISSION_DENIED", details: [{ reason }] } });

  it("401 is unauthorized", () => {
    expect(classifyDriveError(401, {})).toBe("unauthorized");
  });

  it.each([
    ["classic insufficientPermissions", classic("insufficientPermissions")],
    ["modern ACCESS_TOKEN_SCOPE_INSUFFICIENT", modern("ACCESS_TOKEN_SCOPE_INSUFFICIENT")],
  ])("403 %s is insufficient_scope", (_label, body) => {
    expect(classifyDriveError(403, body)).toBe("insufficient_scope");
  });

  it.each(["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"])(
    "403 %s is temporary (quota, not permission)",
    (reason) => {
      expect(classifyDriveError(403, classic(reason))).toBe("temporary");
    },
  );

  it("403 with an unknown reason or no body is temporary", () => {
    expect(classifyDriveError(403, classic("somethingElse"))).toBe("temporary");
    expect(classifyDriveError(403, undefined)).toBe("temporary");
  });

  it.each([429, 500, 502, 503, 504, 400, 404])("%i is temporary", (status) => {
    expect(classifyDriveError(status, {})).toBe("temporary");
  });

  it("maps a real 401 response through listRecentFiles", async () => {
    fetchMock.mockResolvedValue(json(401, { error: { code: 401 } }));
    expect(await listRecentFiles("t")).toEqual({ ok: false, reason: "unauthorized" });
  });
});
