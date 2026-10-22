import "server-only";
import { getServerEnv } from "@/lib/env";

// Endpoints from https://accounts.google.com/.well-known/openid-configuration (checked 2026-10-22).
export const GOOGLE_ENDPOINTS = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
  jwks: "https://www.googleapis.com/oauth2/v3/certs",
  driveFiles: "https://www.googleapis.com/drive/v3/files",
} as const;

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
export const GOOGLE_SCOPES = ["openid", "email", "profile", DRIVE_SCOPE] as const;

export const OAUTH_CALLBACK_PATH = "/api/oauth/google/callback";
export const OAUTH_COOKIE_NAME = "cx_google_oauth";
export const OAUTH_COOKIE_PATH = "/api/oauth/google";
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/** Every outbound call to Google times out after 10 seconds (NFR-06). */
export const GOOGLE_TIMEOUT_MS = 10_000;

export type GoogleClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getGoogleClientConfig(): GoogleClientConfig {
  const env = getServerEnv();
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}${OAUTH_CALLBACK_PATH}`,
  };
}
