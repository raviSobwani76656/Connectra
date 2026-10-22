"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { ResendConfirmation } from "./resend-confirmation";

/** Shown after sign-up when Supabase requires email confirmation (D-017, AC-12.1). */
export function CheckEmail({ email }: { email: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new content so screen readers announce the change.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-zinc-900 outline-none">
        Check your email
      </h2>
      <p className="text-zinc-700">
        We&apos;ve sent a confirmation link to your email address. Click it to activate your
        account, then log in.
      </p>
      <ResendConfirmation email={email} />
      <Link href={LOGIN_PATH} className="text-sm font-medium text-zinc-900 underline underline-offset-2">
        Back to log in
      </Link>
    </div>
  );
}
