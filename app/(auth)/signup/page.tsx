import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up · Connectra" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Create your account</h1>
      <AuthForm mode="signup" />
    </>
  );
}
