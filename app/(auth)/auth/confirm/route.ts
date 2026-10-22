import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { CONFIRM_ERROR_PATH, LOGIN_PATH } from "@/lib/auth/routes";
import { confirmParamsSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for the "Confirm signup" email link (D-017, D-023):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Confirms the address but never leaves the browser signed in: whoever opens the link
 * must then log in with their own password. Otherwise a link from someone else's sign-up
 * could sign this browser into *their* account (login CSRF).
 * Redirects only to fixed in-app paths; the token is never logged.
 */
export async function GET(request: NextRequest) {
  const parsed = confirmParamsSchema.safeParse({
    token_hash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  });
  if (!parsed.success) {
    redirect(`${CONFIRM_ERROR_PATH}?reason=invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: parsed.data.type,
    token_hash: parsed.data.token_hash,
  });

  if (error) {
    logAuthErrorInDev("verifyOtp", error);
    redirect(`${CONFIRM_ERROR_PATH}?reason=${error.code === "otp_expired" ? "expired" : "invalid"}`);
  }

  if (data.session) {
    // End the session verifyOtp just created (this browser only) and clear its cookies.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      logAuthErrorInDev("verifyOtp.signOut", signOutError);
    }
  }

  redirect(`${LOGIN_PATH}?notice=email-confirmed`);
}
