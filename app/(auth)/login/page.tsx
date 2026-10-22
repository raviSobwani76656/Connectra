import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in · Connectra" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Log in</h1>
      <AuthForm mode="login" />
    </>
  );
}
