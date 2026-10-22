import "server-only";
import { logAuthErrorInDev } from "@/lib/auth/dev-log";
import { requireUser } from "@/lib/auth/dal";
import { CURRENT_KEY_VERSION, decryptForUser, encryptForUser } from "@/lib/crypto/encryption";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClientConfig } from "./config";
import { listRecentFiles, type DriveFile } from "./drive";
import { formatKolkata } from "./format";
import { refreshAccessToken } from "./oauth";

const TABLE = "google_connections";

export type GoogleDashboardState =
  | { kind: "not_connected" }
  /** State C (D-021): shown once; the row has already been deleted. */
  | { kind: "expired"; reason: "expired" | "insufficient_scope" }
  /** The connection row could not be read (database problem). Nothing is changed. */
  | { kind: "unavailable" }
  | {
      kind: "connected";
      name: string | null;
      email: string;
      connectedSince: string;
      files: { ok: true; items: DriveFile[] } | { ok: false };
    };

type ConnectionRow = {
  refresh_token_enc: string;
  google_email_enc: string;
  google_name_enc: string | null;
  key_version: number;
  created_at: string;
};

type Decrypted = { refreshToken: string; email: string; name: string | null; createdAt: string };

function decryptRow(userId: string, row: ConnectionRow): Decrypted | null {
  if (row.key_version !== CURRENT_KEY_VERSION) {
    return null;
  }
  try {
    return {
      refreshToken: decryptForUser(userId, "refresh_token", row.refresh_token_enc),
      email: decryptForUser(userId, "google_email", row.google_email_enc),
      name: row.google_name_enc ? decryptForUser(userId, "google_name", row.google_name_enc) : null,
      createdAt: row.created_at,
    };
  } catch {
    logAuthErrorInDev("google.connection.decrypt", { code: "decryption_failed" });
    return null;
  }
}

async function loadRow(userId: string): Promise<{ ok: true; row: ConnectionRow | null } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("refresh_token_enc, google_email_enc, google_name_enc, key_version, created_at")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>();
  if (error) {
    logAuthErrorInDev("google.connection.load", { code: error.code });
    return { ok: false };
  }
  return { ok: true, row: data };
}

/** Deletes the signed-in user's connection row (RLS also restricts it to their own row). */
export async function deleteGoogleConnection(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).delete().eq("user_id", user.id);
  if (error) {
    logAuthErrorInDev("google.connection.delete", { code: error.code });
    return false;
  }
  return true;
}

/** Encrypts and upserts the signed-in user's single connection; reconnecting replaces it. */
export async function saveGoogleConnection(values: {
  refreshToken: string;
  email: string;
  name: string | null;
}): Promise<boolean> {
  const user = await requireUser();
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      refresh_token_enc: encryptForUser(user.id, "refresh_token", values.refreshToken),
      google_email_enc: encryptForUser(user.id, "google_email", values.email),
      google_name_enc: values.name ? encryptForUser(user.id, "google_name", values.name) : null,
      key_version: CURRENT_KEY_VERSION,
      // "Connected since" means the latest connection, so a reconnect resets it.
      created_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    logAuthErrorInDev("google.connection.save", { code: error.code });
    return false;
  }
  return true;
}

/** The decrypted refresh token, for revocation; null if there is no usable connection. */
export async function readRefreshToken(): Promise<string | null> {
  const user = await requireUser();
  const loaded = await loadRow(user.id);
  if (!loaded.ok || !loaded.row) {
    return null;
  }
  return decryptRow(user.id, loaded.row)?.refreshToken ?? null;
}

async function expire(reason: "expired" | "insufficient_scope"): Promise<GoogleDashboardState> {
  await deleteGoogleConnection();
  return { kind: "expired", reason };
}

/**
 * Everything the dashboard's Google section needs, for the signed-in user only (D-019, D-021).
 * At most one token refresh and one files.list, plus one retry of each after a 401.
 */
export async function getGoogleDashboardState(): Promise<GoogleDashboardState> {
  const user = await requireUser();
  const loaded = await loadRow(user.id);
  if (!loaded.ok) {
    return { kind: "unavailable" };
  }
  if (!loaded.row) {
    return { kind: "not_connected" };
  }

  const connection = decryptRow(user.id, loaded.row);
  if (!connection) {
    return expire("expired");
  }

  const connected = (files: { ok: true; items: DriveFile[] } | { ok: false }): GoogleDashboardState => ({
    kind: "connected",
    name: connection.name,
    email: connection.email,
    connectedSince: formatKolkata(connection.createdAt),
    files,
  });

  const config = getGoogleClientConfig();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await refreshAccessToken(config, connection.refreshToken);
    if (!token.ok) {
      return token.reason === "invalid_grant" ? expire("expired") : connected({ ok: false });
    }

    const list = await listRecentFiles(token.accessToken);
    if (list.ok) {
      return connected({ ok: true, items: list.files });
    }
    if (list.reason === "insufficient_scope") {
      return expire("insufficient_scope");
    }
    if (list.reason === "temporary") {
      return connected({ ok: false });
    }
    // 401: try once more with a fresh access token.
  }
  return expire("expired");
}
