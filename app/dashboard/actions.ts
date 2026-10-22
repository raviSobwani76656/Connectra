"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Ends this session in Supabase and clears the session cookies.
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
