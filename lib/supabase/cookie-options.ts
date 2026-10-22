import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Session cookie settings, merged over @supabase/ssr's defaults.
 * The library defaults to httpOnly: false so a browser client can read the session;
 * Connectra has no browser client, so page scripts never need the cookie (SR-11).
 * Secure is set whenever the app runs on https (D-014).
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.APP_URL?.startsWith("https://") ?? false,
};
