import { describe, expect, it } from "vitest";
import { fileTypeLabel, formatKolkata, safeDriveLink } from "@/lib/google/format";

describe("fileTypeLabel (BR-06)", () => {
  it.each([
    ["application/vnd.google-apps.folder", "Folder"],
    ["application/vnd.google-apps.document", "Google Docs"],
    ["application/vnd.google-apps.spreadsheet", "Google Sheets"],
    ["application/vnd.google-apps.presentation", "Google Slides"],
    ["application/pdf", "PDF"],
    ["image/png", "Image"],
    ["image/jpeg", "Image"],
    ["video/mp4", "Video"],
    ["application/msword", "Word"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word"],
    ["application/vnd.ms-excel", "Excel"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel"],
    ["application/vnd.ms-powerpoint", "PowerPoint"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PowerPoint"],
    ["text/plain", "Text"],
    ["text/csv", "Text"],
  ])("%s -> %s", (mime, label) => {
    expect(fileTypeLabel(mime)).toBe(label);
  });

  it.each([
    "application/zip",
    "application/vnd.google-apps.form",
    "application/vnd.google-apps.shortcut",
    "application/octet-stream",
    "weird",
  ])("falls back to File and never shows the raw type: %s", (mime) => {
    expect(fileTypeLabel(mime)).toBe("File");
  });
});

describe("formatKolkata (BR-07)", () => {
  it.each([
    ["2026-10-22T08:35:00Z", "22 Oct 2026, 14:05"],
    ["2026-10-21T20:00:00Z", "22 Oct 2026, 01:30"], // crosses midnight into the next day in IST
    ["2026-09-05T00:00:00.123Z", "5 Sep 2026, 05:30"], // fixed "Sep", not "Sept"
    ["2026-12-31T18:29:00Z", "31 Dec 2026, 23:59"],
    ["2026-12-31T18:30:00Z", "1 Jan 2027, 00:00"],
    ["2026-01-01T06:30:00+05:30", "1 Jan 2026, 06:30"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatKolkata(iso)).toBe(expected);
  });

  it("handles an invalid date without throwing", () => {
    expect(formatKolkata("not a date")).toBe("Unknown date");
  });
});

describe("safeDriveLink (BR-13)", () => {
  it.each([
    "https://drive.google.com/file/d/abc/view?usp=drivesdk",
    "https://docs.google.com/document/d/abc/edit?usp=drivesdk",
    "https://drive.google.com/drive/folders/abc",
  ])("accepts Google Drive links: %s", (link) => {
    expect(safeDriveLink(link)).toBe(link);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,hi"],
    ["http", "http://drive.google.com/file/d/abc"],
    ["other host", "https://evil.example/file"],
    ["look-alike host", "https://drive.google.com.evil.example/x"],
    ["subdomain trick", "https://evil.drive.google.com/x"],
    ["credentials", "https://user:pass@drive.google.com/x"],
    ["custom port", "https://drive.google.com:8443/x"],
    ["not a URL", "drive.google.com/x"],
  ])("rejects %s", (_label, link) => {
    expect(safeDriveLink(link)).toBeNull();
  });
});
