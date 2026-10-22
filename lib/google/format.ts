// Pure display helpers for Drive metadata (BR-06, BR-07, BR-13). No server-only import:
// they hold no secrets and are unit-tested directly.

const EXACT_LABELS: Record<string, string> = {
  "application/vnd.google-apps.folder": "Folder",
  "application/vnd.google-apps.document": "Google Docs",
  "application/vnd.google-apps.spreadsheet": "Google Sheets",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
};

/** Friendly type label; never the raw MIME type. */
export function fileTypeLabel(mimeType: string): string {
  const exact = EXACT_LABELS[mimeType];
  if (exact) return exact;
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("text/")) return "Text";
  return "File";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const kolkataParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "22 Oct 2026, 14:05" in Asia/Kolkata. Month names are fixed here rather than taken from
 * the locale, so the output does not change between Node/ICU versions (e.g. "Sept").
 */
export function formatKolkata(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    kolkataParts.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${Number(part("day"))} ${MONTHS[Number(part("month")) - 1]} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

/** The Google-provided link, only if it is https on a Google Drive/Docs host (BR-13). */
export function safeDriveLink(link: string | undefined): string | null {
  if (!link || !URL.canParse(link)) {
    return null;
  }
  const url = new URL(link);
  if (url.protocol !== "https:" || !DRIVE_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
    return null;
  }
  return url.toString();
}
