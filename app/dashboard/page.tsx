import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Dashboard · Connectra" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <p className="text-sm font-semibold tracking-wide text-zinc-500">CONNECTRA</p>
          <div className="flex items-center gap-4">
            {user.email && (
              <p className="hidden text-sm text-zinc-700 sm:block">
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

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <section aria-labelledby="google-heading" className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 id="google-heading" className="text-lg font-semibold text-zinc-900">
            Google Drive
          </h2>
          <p className="mt-2 text-sm text-zinc-700">Connecting Google Drive will be available soon.</p>
        </section>
      </main>
    </div>
  );
}
