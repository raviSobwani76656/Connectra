/**
 * Development only: logs the Supabase error code and HTTP status, never user data
 * (no emails, passwords, tokens or messages). Plain text, because Next's development
 * log file writes logged objects as "{}" (D-016).
 */
export function logAuthErrorInDev(operation: string, error: { code?: string; status?: number }) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[auth] ${operation} failed code=${error.code ?? "none"} status=${error.status ?? "none"}`);
  }
}
