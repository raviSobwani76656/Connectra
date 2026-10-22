"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { deleteAccountSchema } from "@/lib/auth/schemas";
import { dashboardUrl } from "@/lib/dashboard/messages";
import { deleteGoogleConnection, readRefreshToken } from "@/lib/google/connection";
import { revokeToken } from "@/lib/google/oauth";
// The only import of the admin client in the app (D-013; enforced by tests/unit/admin-usage.test.ts).
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/supabase/password-check";
import { createClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Ends this session in Supabase and clears the session cookies.
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

/** FR-10: best-effort revoke at Google, then always delete the stored connection. */
export async function disconnectGoogle(): Promise<void> {
  await requireUser();
  const refreshToken = await readRefreshToken();
  const revoked = refreshToken ? await revokeToken(refreshToken) : true;
  const deleted = await deleteGoogleConnection();
  if (!deleted) {
    redirect(dashboardUrl("google-error"));
  }
  redirect(dashboardUrl(revoked ? "google-disconnected" : "google-disconnected-unconfirmed"));
}

export type DeleteAccountState = {
  formError?: string;
  fieldErrors?: { password?: string; confirmation?: string };
};

/** FR-11: re-check the password, revoke Google (best effort), delete the user, sign out. */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await requireUser();

  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    const fieldErrors: DeleteAccountState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "password" || field === "confirmation") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }
  if (!user.email) {
    return { formError: "Could not delete your account. Please try again." };
  }

  const check = await verifyPassword(user.id, user.email, parsed.data.password);
  if (check === "wrong") {
    return { fieldErrors: { password: "Incorrect password." } };
  }
  if (check === "rate_limited") {
    return { formError: "Too many attempts. Please wait a minute and try again." };
  }
  if (check === "error") {
    return { formError: "Could not check your password. Please try again." };
  }

  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    await revokeToken(refreshToken);
  }

  // Hard delete; google_connections is removed by ON DELETE CASCADE.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    logAuthErrorInDev("admin.deleteUser", error);
    return { formError: "Could not delete your account. Please try again." };
  }

  // The user no longer exists, so signOut may fail; clear the session cookies regardless.
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => undefined);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      cookieStore.delete(cookie.name);
    }
  }

  redirect(`${LOGIN_PATH}?notice=account-deleted`);
}
