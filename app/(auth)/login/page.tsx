import type { Metadata } from "next";
import { loginNoticeSchema } from "@/lib/auth/schemas";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in · Connectra" };

// Fixed text per notice: the query string is never shown to the user.
const NOTICES = {
  "email-confirmed": "Your email is confirmed. You can now log in.",
  "account-deleted": "Your account has been deleted.",
} as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const parsed = loginNoticeSchema.safeParse((await searchParams).notice);

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Log in</h1>
      <AuthForm mode="login" notice={parsed.success ? NOTICES[parsed.data] : undefined} />
    </>
  );
}
