import "server-only";
import { GOOGLE_TIMEOUT_MS } from "./config";

/**
 * fetch with a hard timeout and no caching. Rejects (AbortError/TimeoutError) on timeout,
 * so callers treat any rejection as a temporary failure.
 */
export function googleFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
}
