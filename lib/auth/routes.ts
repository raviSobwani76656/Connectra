// Pure redirect rules used by proxy.ts. Kept separate so they can be unit-tested.

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const DASHBOARD_PATH = "/dashboard";

const PROTECTED_PREFIXES = [DASHBOARD_PATH];
const SIGNED_OUT_ONLY = [LOGIN_PATH, SIGNUP_PATH];

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Where to send the visitor, or `null` to let the request through.
 * This is an optimistic first check only; pages and actions re-check with requireUser().
 */
export function redirectFor(pathname: string, isSignedIn: boolean): string | null {
  if (!isSignedIn && PROTECTED_PREFIXES.some((base) => matches(pathname, base))) {
    return LOGIN_PATH;
  }
  if (isSignedIn && SIGNED_OUT_ONLY.some((base) => matches(pathname, base))) {
    return DASHBOARD_PATH;
  }
  return null;
}
