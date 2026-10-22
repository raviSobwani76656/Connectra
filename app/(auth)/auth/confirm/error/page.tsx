import type { Metadata } from "next";
import Link from "next/link";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { confirmErrorReasonSchema } from "@/lib/auth/schemas";
import { ResendConfirmation } from "../../../resend-confirmation";

export const metadata: Metadata = { title: "Confirmation link problem · Connectra" };

// Fixed text per reason: the query string is never shown to the user.
const MESSAGES = {
  expired: {
    title: "This link has expired",
    body: "Confirmation links can only be used once and stop working after a while.",
  },
  invalid: {
    title: "This link is not valid",
    body: "The confirmation link may be incomplete, already used, or opened by an email security scanner before you clicked it.",
  },
} as const;

export default async function ConfirmErrorPage({ searchParams }: PageProps<"/auth/confirm/error">) {
  const parsed = confirmErrorReasonSchema.safeParse((await searchParams).reason);
  const message = MESSAGES[parsed.success ? parsed.data : "invalid"];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-zinc-900">{message.title}</h1>
      <p className="text-zinc-700">{message.body}</p>
      <p className="text-zinc-700">Enter your email to get a new confirmation link.</p>
      <ResendConfirmation />
      <Link href={LOGIN_PATH} className="text-sm font-medium text-zinc-900 underline underline-offset-2">
        Back to log in
      </Link>
    </div>
  );
}
