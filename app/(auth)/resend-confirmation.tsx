"use client";

import { useActionState, useEffect, useState } from "react";
import { secondsUntilResendAllowed } from "@/lib/auth/resend-cooldown";
import { resendConfirmation, type ResendState } from "./actions";

const initialState: ResendState = {};

/**
 * "Resend confirmation email" control. Uses the email already typed when known;
 * otherwise asks for it. Disabled for 60 seconds after each request.
 */
export function ResendConfirmation({ email }: { email?: string }) {
  const [state, formAction, isPending] = useActionState(resendConfirmation, initialState);
  // Updated by the timer only; a stale value reads as "just sent", so the countdown starts at 60.
  const [now, setNow] = useState(0);
  const remaining = secondsUntilResendAllowed(state.sentAt, now);
  const coolingDown = remaining > 0;

  useEffect(() => {
    if (!coolingDown) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="resend-email" className="text-sm font-medium text-zinc-900">
            Email
          </label>
          <input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-zinc-400 px-3 py-2 text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={isPending || coolingDown}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "Sending…"
          : coolingDown
            ? `Resend available in ${remaining}s`
            : "Resend confirmation email"}
      </button>
      <p
        role="status"
        className={`min-h-5 text-sm ${state.tone === "error" ? "text-red-700" : "text-zinc-700"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
