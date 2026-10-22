"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { logIn, signUp, type AuthFormState } from "./actions";
import { CheckEmail } from "./check-email";
import { PasswordInput } from "./password-input";
import { ResendConfirmation } from "./resend-confirmation";

type Mode = "login" | "signup";

const COPY = {
  login: {
    action: logIn,
    submit: "Log in",
    pending: "Logging in…",
    passwordAutocomplete: "current-password",
    switchText: "No account yet?",
    switchLink: "Sign up",
    switchHref: "/signup",
  },
  signup: {
    action: signUp,
    submit: "Create account",
    pending: "Creating account…",
    passwordAutocomplete: "new-password",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

const initialState: AuthFormState = {};

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const copy = COPY[mode];
  const [state, formAction, isPending] = useActionState(copy.action, initialState);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;
  const needsConfirmation = state.status === "needs-confirmation";

  if (state.status === "check-email") {
    return <CheckEmail email={state.email ?? ""} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && !state.formError && (
        <p role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          {notice}
        </p>
      )}

      {needsConfirmation && (
        // Outside the log-in form: forms cannot be nested.
        <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
          <p role="alert" className="text-sm text-amber-900">
            {state.formError}
          </p>
          <ResendConfirmation email={state.email} />
        </div>
      )}

      <form action={formAction} noValidate className="flex flex-col gap-5">
        {state.formError && !needsConfirmation && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.formError}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-900">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            className="rounded-md border border-zinc-400 px-3 py-2 text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20 aria-invalid:border-red-600"
          />
          {emailError && (
            <p id="email-error" className="text-sm text-red-700">
              {emailError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-zinc-900">
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={copy.passwordAutocomplete}
            invalid={Boolean(passwordError)}
            describedBy={
              [mode === "signup" ? "password-hint" : null, passwordError ? "password-error" : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
          {mode === "signup" && (
            <p id="password-hint" className="text-sm text-zinc-600">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          )}
          {passwordError && (
            <p id="password-error" className="text-sm text-red-700">
              {passwordError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60"
        >
          {isPending ? copy.pending : copy.submit}
        </button>

        <p className="text-sm text-zinc-700">
          {copy.switchText}{" "}
          <Link href={copy.switchHref} className="font-medium text-zinc-900 underline underline-offset-2">
            {copy.switchLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
