"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/app/(auth)/password-input";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = {};

/** Danger zone form (FR-11): current password plus typing DELETE. */
export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState(deleteAccount, initialState);
  const passwordError = state.fieldErrors?.password;
  const confirmationError = state.fieldErrors?.confirmation;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="delete-password" className="text-sm font-medium text-zinc-900">
          Your password
        </label>
        <PasswordInput
          id="delete-password"
          name="password"
          autoComplete="current-password"
          invalid={Boolean(passwordError)}
          describedBy={passwordError ? "delete-password-error" : undefined}
        />
        {passwordError && (
          <p id="delete-password-error" role="alert" className="text-sm text-red-700">
            {passwordError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="delete-confirmation" className="text-sm font-medium text-zinc-900">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirmation"
          name="confirmation"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          aria-invalid={confirmationError ? true : undefined}
          aria-describedby={confirmationError ? "delete-confirmation-error" : undefined}
          className="rounded-md border border-zinc-400 px-3 py-2 text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20 aria-invalid:border-red-600"
        />
        {confirmationError && (
          <p id="delete-confirmation-error" role="alert" className="text-sm text-red-700">
            {confirmationError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
      >
        {isPending ? "Deleting account…" : "Delete my account permanently"}
      </button>
    </form>
  );
}
