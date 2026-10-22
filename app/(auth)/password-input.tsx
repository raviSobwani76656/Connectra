"use client";

import { useEffect, useRef, useState } from "react";

type PasswordInputProps = {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Password field with a show/hide toggle. The value stays in the browser's own
 * (uncontrolled) input; this component never reads, stores or logs it.
 */
export function PasswordInput({ id, name, autoComplete, invalid, describedBy }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide the password again whenever its form is submitted.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        // Visible passwords are plain text: keep them out of spellcheck and autocorrect.
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        required
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-md border border-zinc-400 py-2 pr-11 pl-3 text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20 aria-invalid:border-red-600"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-900"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.25 5 12 5s10.5 7 10.5 7-3.75 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.25 5 12 5s10.5 7 10.5 7-3.75 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
