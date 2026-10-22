import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { CONFIRM_ERROR_PATH, DASHBOARD_PATH, LOGIN_PATH } from "@/lib/auth/routes";
import { confirmParamsSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for the "Confirm signup" email link (D-017):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Redirects only to fixed in-app paths; no `next` or redirect parameter is accepted.
 * The token is never logged.
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

  // verifyOtp signs the user in (session cookies set by the server client) when it can.
  redirect(data.session ? DASHBOARD_PATH : `${LOGIN_PATH}?notice=email-confirmed`);
}
