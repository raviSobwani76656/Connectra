import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { dashboardMessageFor } from "@/lib/dashboard/messages";
import { signOut } from "./actions";
import { DeleteAccountForm } from "./delete-account-form";
import { GoogleSection, GoogleSectionPlaceholder } from "./google-section";
import { MessageBanner } from "./message-banner";

export const metadata: Metadata = { title: "Dashboard · Connectra" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const messageCode = (await searchParams).message;
  const message = dashboardMessageFor(messageCode);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
          <p className="text-sm font-semibold tracking-wide text-zinc-500">Connectra</p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            {user.email && (
              <p className="min-w-0 text-sm break-all text-zinc-700">
                Signed in as <span className="font-medium text-zinc-900">{user.email}</span>
              </p>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>

        {message && <MessageBanner key={String(messageCode)} message={message} />}

        {/* Waits for Google; everything else on the page renders without it (D-021). */}
        <Suspense fallback={<GoogleSectionPlaceholder />}>
          <GoogleSection />
        </Suspense>

        <section aria-labelledby="danger-heading" className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
          <h2 id="danger-heading" className="text-lg font-semibold text-red-800">Danger zone</h2>
          <h3 className="mt-4 font-medium text-zinc-900">Delete account</h3>
          <p className="mt-1 mb-4 text-sm text-zinc-700">
            Permanently deletes your Connectra account and all data stored about you, and removes
            Connectra&apos;s access to your Google account. This cannot be undone.
          </p>
          <DeleteAccountForm />
        </section>
      </main>
    </div>
  );
}
