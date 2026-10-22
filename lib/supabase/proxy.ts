import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redirectFor } from "@/lib/auth/routes";
import { getPublicEnv } from "@/lib/env.public";
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Refreshes the Supabase session cookies on every request and applies the
 * optimistic redirect rules. Uses only the public anon key; no secrets.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not add code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = typeof data?.claims?.sub === "string";

  const target = redirectFor(request.nextUrl.pathname, isSignedIn);
  if (!target) {
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed session cookies and cache headers on the redirect.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) {
    redirect.headers.set("cache-control", cacheControl);
  }
  return redirect;
}
