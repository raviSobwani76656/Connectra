/** Short machine codes only; anything else (e.g. free text that slipped in) is not printed. */
const SAFE_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

export function safeLogCode(value: unknown): string {
  if (value === undefined || value === null || value === "") return "none";
  const text = String(value);
  return SAFE_CODE.test(text) ? text : "unrecognised";
}

/**
 * Development only: logs an error code and HTTP status, never user data
 * (no emails, passwords, tokens, names, file names or messages). Plain text, because
 * Next's development log file writes logged objects as "{}" (D-016).
 */
export function logAuthErrorInDev(operation: string, error: { code?: string; status?: number }) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[auth] ${operation} failed code=${safeLogCode(error.code)} status=${safeLogCode(error.status)}`);
  }
}
