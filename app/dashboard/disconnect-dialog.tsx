"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { disconnectGoogle } from "./actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

/** "Disconnect Google Drive" with a native modal dialog for confirmation (FR-10). */
export function DisconnectDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        Disconnect Google Drive
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="disconnect-title"
        aria-describedby="disconnect-description"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 p-6 shadow-lg backdrop:bg-black/40"
      >
        <h2 id="disconnect-title" className="text-lg font-semibold text-zinc-900">
          Disconnect Google Drive?
        </h2>
        <p id="disconnect-description" className="mt-2 text-sm text-zinc-700">
          You&apos;ll need to reconnect to see your files.
        </p>
        <form action={disconnectGoogle} className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            Cancel
          </button>
          <ConfirmButton />
        </form>
      </dialog>
    </>
  );
}
