"use server";

import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/auth/routes";
import {
  logInSchema,
  readAuthForm,
  signUpSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  formError?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so the user does not retype it. The password is never echoed. */
  email?: string;
};

const RATE_LIMITED = "Too many attempts. Please wait a minute and try again.";

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
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        // Known limitation L-02: with email confirmation off this reveals that the account exists.
        return { formError: "An account with this email already exists. Log in instead.", email };
      case "weak_password":
        return { fieldErrors: { password: "Choose a stronger password." }, email };
      case "over_request_rate_limit":
      case "over_email_send_rate_limit":
        return { formError: RATE_LIMITED, email };
      default:
        return { formError: "Could not create your account. Please try again.", email };
    }
  }

  if (!data.session) {
    // Happens if "Confirm email" is still switched on in Supabase (D-005 expects it off).
    return {
      formError: "Account created, but you could not be signed in. Check that email confirmation is off in Supabase.",
      email,
    };
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
    if (error.code === "over_request_rate_limit") {
      return { formError: RATE_LIMITED, email };
    }
    // Same message for unknown email and wrong password (PROJECT_BRIEF AC-2.2).
    return { formError: "Invalid email or password.", email };
  }

  redirect(DASHBOARD_PATH);
}
