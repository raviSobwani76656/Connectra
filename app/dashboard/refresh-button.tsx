"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-renders the dashboard on the server, which fetches the file list again (AC-7.7). */
export function RefreshButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60"
    >
      {isPending ? "Refreshing…" : label}
    </button>
  );
}
