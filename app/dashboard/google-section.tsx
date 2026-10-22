import type { ReactNode } from "react";
import { getGoogleDashboardState } from "@/lib/google/connection";
import { DisconnectDialog } from "./disconnect-dialog";
import { FileTable } from "./file-table";
import { RefreshButton } from "./refresh-button";

const START_URL = "/api/oauth/google/start";

const cardClass = "rounded-xl border border-zinc-200 bg-white p-4 sm:p-6";

// A plain <a>, not <Link>: the start route is a redirect to Google and must not be prefetched.
function ConnectLink({ children }: { children: ReactNode }) {
  return (
    <a
      href={START_URL}
      className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      {children}
    </a>
  );
}

/**
 * The connection card and recent files, rendered together inside one Suspense boundary
 * because the card's state depends on Google's token response (D-021).
 */
export async function GoogleSection() {
  const state = await getGoogleDashboardState();

  if (state.kind === "not_connected") {
    return (
      <section aria-labelledby="google-heading" className={cardClass}>
        <h2 id="google-heading" className="text-lg font-semibold text-zinc-900">Google Drive</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Connect your Google Drive to see your account details and recent files.
        </p>
        <div className="mt-4">
          <ConnectLink>Connect Google Drive</ConnectLink>
        </div>
      </section>
    );
  }

  if (state.kind === "expired") {
    return (
      <section aria-labelledby="google-heading" className={cardClass}>
        <h2 id="google-heading" className="text-lg font-semibold text-zinc-900">Google Drive</h2>
        <p role="status" className="mt-2 text-sm text-zinc-700">
          {state.reason === "insufficient_scope"
            ? "Google Drive access wasn't fully granted. Please reconnect and allow access to your Drive files."
            : "Your Google Drive connection has expired or was removed. Please reconnect."}
        </p>
        <div className="mt-4">
          <ConnectLink>Reconnect Google Drive</ConnectLink>
        </div>
      </section>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <section aria-labelledby="google-heading" className={cardClass}>
        <h2 id="google-heading" className="text-lg font-semibold text-zinc-900">Google Drive</h2>
        <p role="alert" className="mt-2 text-sm text-zinc-700">
          Couldn&apos;t load your Google Drive connection right now. Please try again.
        </p>
        <div className="mt-4">
          <RefreshButton label="Try again" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="google-heading" className={cardClass}>
        <h2 id="google-heading" className="text-lg font-semibold text-zinc-900">Google Drive</h2>
        <dl className="mt-3 grid gap-1 text-sm">
          {state.name && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-600">Name</dt>
              <dd className="font-medium text-zinc-900">{state.name}</dd>
            </div>
          )}
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-600">Email</dt>
            <dd className="font-medium break-all text-zinc-900">{state.email}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-600">Connected since</dt>
            <dd className="text-zinc-900">{state.connectedSince}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <DisconnectDialog />
        </div>
      </section>

      <section aria-labelledby="files-heading" className={cardClass}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="files-heading" className="text-lg font-semibold text-zinc-900">Recent files</h2>
          <RefreshButton />
        </div>
        {state.files.ok ? (
          <FileTable files={state.files.items} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-zinc-700">
              Couldn&apos;t load your files right now. Please try again.
            </p>
            <RefreshButton label="Try again" />
          </div>
        )}
      </section>
    </>
  );
}

export function GoogleSectionPlaceholder() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-900">Google Drive</h2>
        <p role="status" className="mt-2 text-sm text-zinc-600">Loading your Google Drive…</p>
        <div className="mt-4 h-9 w-48 animate-pulse rounded-md bg-zinc-100" />
      </section>
    </div>
  );
}
