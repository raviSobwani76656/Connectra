"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DashboardMessage } from "@/lib/dashboard/messages";

const TONES: Record<DashboardMessage["tone"], string> = {
  success: "border-green-300 bg-green-50 text-green-900",
  info: "border-zinc-300 bg-zinc-100 text-zinc-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-900",
};

/** Dismissible banner. The text comes from the fixed list in lib/dashboard/messages.ts. */
export function MessageBanner({ message }: { message: DashboardMessage }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return null;
  }

  return (
    <div
      role={message.tone === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm ${TONES[message.tone]}`}
    >
      <p>{message.text}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          // Drop the code from the URL so a reload does not show the message again.
          router.replace("/dashboard", { scroll: false });
        }}
        aria-label="Dismiss message"
        className="-m-1 shrink-0 rounded p-1 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}
