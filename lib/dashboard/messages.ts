import { z } from "zod";

/**
 * Banner messages after redirects (D-021). The URL carries only a short code; the text
 * always comes from this fixed list, never from the URL.
 */
export const DASHBOARD_MESSAGES = {
  "google-connected": { tone: "success", text: "Google Drive connected." },
  "google-disconnected": { tone: "success", text: "Google Drive disconnected." },
  "google-disconnected-unconfirmed": {
    tone: "warning",
    text: "Disconnected here, but we couldn't confirm with Google. You can remove access at myaccount.google.com/permissions.",
  },
  "google-cancelled": { tone: "info", text: "Connection cancelled. Google Drive was not connected." },
  "google-insufficient-scope": {
    tone: "warning",
    text: "Google Drive access wasn't fully granted. Please reconnect and allow access to your Drive files.",
  },
  "google-error": { tone: "error", text: "Something went wrong connecting Google Drive. Please try again." },
} as const;

export type DashboardMessageCode = keyof typeof DASHBOARD_MESSAGES;
export type DashboardMessage = (typeof DASHBOARD_MESSAGES)[DashboardMessageCode];

const codeSchema = z.enum(Object.keys(DASHBOARD_MESSAGES) as [DashboardMessageCode, ...DashboardMessageCode[]]);

/** The fixed message for a `?message=` value, or null for anything unknown. */
export function dashboardMessageFor(value: unknown): DashboardMessage | null {
  const parsed = codeSchema.safeParse(value);
  return parsed.success ? DASHBOARD_MESSAGES[parsed.data] : null;
}

export function dashboardUrl(code: DashboardMessageCode): string {
  return `/dashboard?message=${code}`;
}
