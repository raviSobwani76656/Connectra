import "server-only";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { GOOGLE_ENDPOINTS } from "./config";
import { fileTypeLabel, formatKolkata, safeDriveLink } from "./format";
import { googleFetch } from "./http";
import { driveErrorSchema, driveListSchema } from "./schemas";

export type DriveFile = {
  id: string;
  name: string;
  typeLabel: string;
  modifiedLabel: string;
  modifiedIso: string;
  link: string | null;
};

/** unauthorized: 401. insufficient_scope: 403 for missing permission. temporary: anything retryable. */
export type DriveFailure = "unauthorized" | "insufficient_scope" | "temporary";
export type DriveListResult = { ok: true; files: DriveFile[] } | { ok: false; reason: DriveFailure };

const PAGE_SIZE = 20;
const SCOPE_REASONS = new Set(["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"]);
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "RATE_LIMIT_EXCEEDED"]);

/** Maps a non-OK Drive response to a failure kind (D-019). */
export function classifyDriveError(status: number, body: unknown): DriveFailure {
  if (status === 401) {
    return "unauthorized";
  }
  if (status === 403) {
    const parsed = driveErrorSchema.safeParse(body);
    const reasons = [
      ...(parsed.data?.error.errors ?? []).map((entry) => entry.reason),
      ...(parsed.data?.error.details ?? []).map((entry) => entry.reason),
    ].filter((reason): reason is string => typeof reason === "string");
    // Quota limits are temporary even though Google sends them as 403.
    if (reasons.some((reason) => RATE_LIMIT_REASONS.has(reason))) {
      return "temporary";
    }
    if (reasons.some((reason) => SCOPE_REASONS.has(reason))) {
      return "insufficient_scope";
    }
  }
  return "temporary";
}

export function driveListUrl(): URL {
  const url = new URL(GOOGLE_ENDPOINTS.driveFiles);
  url.search = new URLSearchParams({
    q: "trashed = false",
    orderBy: "modifiedTime desc",
    pageSize: String(PAGE_SIZE),
    corpora: "user",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  }).toString();
  return url;
}

/** One files.list call. Nothing is cached or stored; file names are never logged. */
export async function listRecentFiles(accessToken: string): Promise<DriveListResult> {
  let response: Response;
  try {
    response = await googleFetch(driveListUrl(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
  } catch {
    logAuthErrorInDev("google.drive.list", { code: "request_failed" });
    return { ok: false, reason: "temporary" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const reason = classifyDriveError(response.status, body);
    logAuthErrorInDev("google.drive.list", { code: reason, status: response.status });
    return { ok: false, reason };
  }

  const parsed = driveListSchema.safeParse(body);
  if (!parsed.success) {
    logAuthErrorInDev("google.drive.list", { code: "invalid_response", status: response.status });
    return { ok: false, reason: "temporary" };
  }

  const files = parsed.data.files
    .slice(0, PAGE_SIZE)
    .map((file) => ({
      id: file.id,
      name: file.name,
      typeLabel: fileTypeLabel(file.mimeType),
      modifiedLabel: formatKolkata(file.modifiedTime),
      modifiedIso: file.modifiedTime,
      link: safeDriveLink(file.webViewLink),
    }));
  return { ok: true, files };
}
