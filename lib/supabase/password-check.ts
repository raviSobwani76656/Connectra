import "server-only";
import { createClient } from "@supabase/supabase-js";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { getPublicEnv } from "@/lib/env.public";

export type PasswordCheck = "ok" | "wrong" | "rate_limited" | "error";

/**
 * Re-checks the signed-in user's password before a destructive action (FR-11).
 * Uses a throwaway client that keeps no session and touches no cookies.
 */
export async function verifyPassword(expectedUserId: string, email: string, password: string): Promise<PasswordCheck> {
  const env = getPublicEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    logAuthErrorInDev("verifyPassword", error);
    if (error.code === "over_request_rate_limit") return "rate_limited";
    if (error.code === "invalid_credentials") return "wrong";
    return "error";
  }
  // The password must belong to the same account that is being deleted.
  return data.user?.id === expectedUserId ? "ok" : "wrong";
}
