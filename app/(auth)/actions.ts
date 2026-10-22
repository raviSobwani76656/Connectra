"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { secondsUntilResendAllowed, RESEND_COOLDOWN_SECONDS } from "@/lib/auth/resend-cooldown";
import { DASHBOARD_PATH } from "@/lib/auth/routes";
import {
  logInSchema,
  readAuthForm,
  resendSchema,
  signUpSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/auth/schemas";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  /** "check-email": sign-up needs confirmation (D-017). "needs-confirmation": unconfirmed login (D-018). */
  status?: "check-email" | "needs-confirmation";
  formError?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so the user does not retype it. The password is never echoed. */
  email?: string;
};

export type ResendState = {
  message?: string;
  tone?: "info" | "error";
  /** When the last email was requested (ms since epoch), for the browser countdown. */
  sentAt?: number;
};

const RATE_LIMITED = "Too many attempts. Please wait a minute and try again.";
const EMAIL_LIMIT_SIGNUP =
  "We couldn't send the confirmation email because the email limit was reached. Please try again in a few minutes.";
const EMAIL_LIMIT_RESEND =
  "We can't send another email right now. Please wait a few minutes and try again.";
const UNCONFIRMED =
  "Please confirm your email address first. Check your inbox for the confirmation link.";
const RESEND_SENT = "If an account needs confirming, we've sent a new link.";

const RESEND_COOKIE = "cx_resend_at";

function submittedEmail(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value.slice(0, 254) : "";
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(readAuthForm(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error), email: submittedEmail(formData) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  const email = parsed.data.email;

  if (error) {
    logAuthErrorInDev("signUp", error);
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        // Only happens with confirmation off: known limitation L-02.
        return { formError: "An account with this email already exists. Log in instead.", email };
      case "weak_password":
        return { fieldErrors: { password: "Choose a stronger password." }, email };
      case "over_email_send_rate_limit":
        return { formError: EMAIL_LIMIT_SIGNUP, email };
      case "over_request_rate_limit":
        return { formError: RATE_LIMITED, email };
      default:
        return { formError: "Could not create your account. Please try again.", email };
    }
  }

  if (!data.session) {
    // Confirmation is on. Supabase answers the same way for new and existing emails,
    // so this screen does not reveal which emails have accounts (BR-12).
    return { status: "check-email", email };
  }

  redirect(DASHBOARD_PATH);
}

export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = logInSchema.safeParse(readAuthForm(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error), email: submittedEmail(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  const email = parsed.data.email;

  if (error) {
    logAuthErrorInDev("signInWithPassword", error);
    if (error.code === "over_request_rate_limit") {
      return { formError: RATE_LIMITED, email };
    }
    if (error.code === "email_not_confirmed") {
      // Supabase only returns this after a correct password (D-018).
      return { status: "needs-confirmation", formError: UNCONFIRMED, email };
    }
    // Same message for unknown email and wrong password (PROJECT_BRIEF AC-2.2).
    return { formError: "Invalid email or password.", email };
  }

  redirect(DASHBOARD_PATH);
}

export async function resendConfirmation(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { tone: "error", message: "Enter a valid email address." };
  }

  // Best-effort cooldown per browser; Supabase's per-user 60-second limit is the real one.
  const cookieStore = await cookies();
  const now = Date.now();
  const lastSentAt = Number(cookieStore.get(RESEND_COOKIE)?.value);
  const wait = secondsUntilResendAllowed(Number.isFinite(lastSentAt) ? lastSentAt : null, now);
  if (wait > 0) {
    return {
      tone: "info",
      message: `Please wait ${wait} seconds before requesting another email.`,
      sentAt: lastSentAt,
    };
  }

  const markSent = () =>
    cookieStore.set(RESEND_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: SUPABASE_COOKIE_OPTIONS.secure,
      maxAge: RESEND_COOLDOWN_SECONDS,
    });

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email });

  if (error) {
    logAuthErrorInDev("resend", error);
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      markSent();
      return { tone: "error", message: EMAIL_LIMIT_RESEND, sentAt: now };
    }
    // Any other outcome looks the same as success, so it never reveals whether the email exists.
  }

  markSent();
  return { tone: "info", message: RESEND_SENT, sentAt: now };
}
