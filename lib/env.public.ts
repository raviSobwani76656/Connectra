import { parsePublicEnv, type PublicEnv } from "./env-schema";

let cached: PublicEnv | undefined;

/** Validated public configuration (safe to expose to the browser). */
export function getPublicEnv(): PublicEnv {
  // Each variable is referenced by its full name so Next.js can inline NEXT_PUBLIC_ values.
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cached;
}
