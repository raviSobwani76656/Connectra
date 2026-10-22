import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: async () => ({ id: "user-a", email: "a@example.com" }) }));

// Fake Supabase table: records every call so tests can check what was stored or deleted.
const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  loadError: null as { code: string } | null,
  upsertError: null as { code: string } | null,
  eqFilters: [] as Array<[string, unknown]>,
  deletes: [] as unknown[],
  upserts: [] as Array<{ values: Record<string, unknown>; options: unknown }>,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== "google_connections") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            db.eqFilters.push([column, value]);
            return { maybeSingle: async () => ({ data: db.row, error: db.loadError }) };
          },
        }),
        delete: () => ({
          eq: async (column: string, value: unknown) => {
            db.eqFilters.push([column, value]);
            db.deletes.push(value);
            return { error: null };
          },
        }),
        upsert: async (values: Record<string, unknown>, options: unknown) => {
          db.upserts.push({ values, options });
          return { error: db.upsertError };
        },
      };
    },
  }),
}));

const google = vi.hoisted(() => ({ refreshAccessToken: vi.fn(), listRecentFiles: vi.fn() }));
vi.mock("@/lib/google/oauth", () => ({ refreshAccessToken: google.refreshAccessToken }));
vi.mock("@/lib/google/drive", () => ({ listRecentFiles: google.listRecentFiles }));

const { encryptForUser, decryptForUser } = await import("@/lib/crypto/encryption");
const { getGoogleDashboardState, readRefreshToken, saveGoogleConnection, deleteGoogleConnection } = await import(
  "@/lib/google/connection"
);

const FILES = [{ id: "f1", name: "Doc", typeLabel: "Google Docs", modifiedLabel: "22 Oct 2026, 14:05", modifiedIso: "2026-10-22T08:35:00Z", link: null }];

function storedRow(userId = "user-a") {
  return {
    refresh_token_enc: encryptForUser(userId, "refresh_token", "1//refresh"),
    google_email_enc: encryptForUser(userId, "google_email", "g@example.com"),
    google_name_enc: encryptForUser(userId, "google_name", "Google Name"),
    key_version: 1,
    created_at: "2026-10-22T08:35:00Z",
  };
}

beforeEach(() => {
  Object.assign(db, { row: null, loadError: null, upsertError: null, eqFilters: [], deletes: [], upserts: [] });
  google.refreshAccessToken.mockReset();
  google.listRecentFiles.mockReset();
});

describe("getGoogleDashboardState (section 4, D-019, D-021)", () => {
  it("State A when there is no row, without calling Google", async () => {
    expect(await getGoogleDashboardState()).toEqual({ kind: "not_connected" });
    expect(google.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("only ever queries the signed-in user's row", async () => {
    await getGoogleDashboardState();
    expect(db.eqFilters).toEqual([["user_id", "user-a"]]);
  });

  it("State B with files, decrypted details and Kolkata date", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: true, files: FILES });
    expect(await getGoogleDashboardState()).toEqual({
      kind: "connected",
      name: "Google Name",
      email: "g@example.com",
      connectedSince: "22 Oct 2026, 14:05",
      files: { ok: true, items: FILES },
    });
    expect(google.refreshAccessToken).toHaveBeenCalledWith(expect.anything(), "1//refresh");
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(google.listRecentFiles).toHaveBeenCalledTimes(1);
    expect(db.deletes).toEqual([]);
  });

  it("decryption failure (tampered or another user's row) deletes the row and shows State C", async () => {
    db.row = storedRow("user-b");
    expect(await getGoogleDashboardState()).toEqual({ kind: "expired", reason: "expired" });
    expect(db.deletes).toEqual(["user-a"]);
    expect(google.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("an unknown key version is treated like a decryption failure", async () => {
    db.row = { ...storedRow(), key_version: 2 };
    expect(await getGoogleDashboardState()).toEqual({ kind: "expired", reason: "expired" });
    expect(db.deletes).toEqual(["user-a"]);
  });

  it("invalid_grant deletes the row and shows State C", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: false, reason: "invalid_grant" });
    expect(await getGoogleDashboardState()).toEqual({ kind: "expired", reason: "expired" });
    expect(db.deletes).toEqual(["user-a"]);
    expect(google.listRecentFiles).not.toHaveBeenCalled();
  });

  it("a temporary token failure keeps the connection and shows the files error", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: false, reason: "temporary" });
    const state = await getGoogleDashboardState();
    expect(state).toMatchObject({ kind: "connected", files: { ok: false } });
    expect(db.deletes).toEqual([]);
  });

  it("401 retries once with a new token, then succeeds", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles
      .mockResolvedValueOnce({ ok: false, reason: "unauthorized" })
      .mockResolvedValueOnce({ ok: true, files: FILES });
    expect(await getGoogleDashboardState()).toMatchObject({ kind: "connected", files: { ok: true } });
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(google.listRecentFiles).toHaveBeenCalledTimes(2);
  });

  it("401 twice: State C, row deleted, and no third attempt", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect(await getGoogleDashboardState()).toEqual({ kind: "expired", reason: "expired" });
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(google.listRecentFiles).toHaveBeenCalledTimes(2);
    expect(db.deletes).toEqual(["user-a"]);
  });

  it("403 insufficient scope: State C with the not-fully-granted reason, row deleted", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: false, reason: "insufficient_scope" });
    expect(await getGoogleDashboardState()).toEqual({ kind: "expired", reason: "insufficient_scope" });
    expect(db.deletes).toEqual(["user-a"]);
  });

  it("temporary Drive failures (403 quota, 429, 5xx, timeout) keep the connection", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: false, reason: "temporary" });
    expect(await getGoogleDashboardState()).toMatchObject({ kind: "connected", email: "g@example.com", files: { ok: false } });
    expect(db.deletes).toEqual([]);
    expect(google.listRecentFiles).toHaveBeenCalledTimes(1);
  });

  it("Drive API not enabled (configuration error) keeps the connection and shows the files error", async () => {
    db.row = storedRow();
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: false, reason: "not_configured" });
    expect(await getGoogleDashboardState()).toMatchObject({ kind: "connected", files: { ok: false } });
    expect(db.deletes).toEqual([]);
    expect(google.listRecentFiles).toHaveBeenCalledTimes(1);
  });

  it("a database error shows 'unavailable' and changes nothing", async () => {
    db.loadError = { code: "PGRST000" };
    expect(await getGoogleDashboardState()).toEqual({ kind: "unavailable" });
    expect(db.deletes).toEqual([]);
  });

  it("shows only the email when Google gave no name", async () => {
    db.row = { ...storedRow(), google_name_enc: null };
    google.refreshAccessToken.mockResolvedValue({ ok: true, accessToken: "ya29" });
    google.listRecentFiles.mockResolvedValue({ ok: true, files: [] });
    expect(await getGoogleDashboardState()).toMatchObject({ kind: "connected", name: null, email: "g@example.com" });
  });
});

describe("saveGoogleConnection (steps 13–14)", () => {
  it("stores only encrypted values, bound to the user and field, with key version 1", async () => {
    expect(await saveGoogleConnection({ refreshToken: "1//refresh", email: "g@example.com", name: "Google Name" })).toBe(true);
    const [{ values, options }] = db.upserts;
    expect(options).toEqual({ onConflict: "user_id" });
    expect(values.user_id).toBe("user-a");
    expect(values.key_version).toBe(1);
    for (const field of ["refresh_token_enc", "google_email_enc", "google_name_enc"] as const) {
      expect(String(values[field]).startsWith("v1.")).toBe(true);
    }
    const serialized = JSON.stringify(values);
    for (const plain of ["1//refresh", "g@example.com", "Google Name"]) expect(serialized).not.toContain(plain);
    expect(decryptForUser("user-a", "refresh_token", String(values.refresh_token_enc))).toBe("1//refresh");
    expect(() => decryptForUser("user-a", "google_email", String(values.refresh_token_enc))).toThrow();
    expect(values).not.toHaveProperty("access_token");
    expect(values).not.toHaveProperty("id_token");
  });

  it("stores no name when Google gave none", async () => {
    await saveGoogleConnection({ refreshToken: "1//r", email: "g@example.com", name: null });
    expect(db.upserts[0].values.google_name_enc).toBeNull();
  });

  it("resets 'connected since' on reconnect", async () => {
    await saveGoogleConnection({ refreshToken: "1//r", email: "g@example.com", name: null });
    expect(Date.now() - Date.parse(String(db.upserts[0].values.created_at))).toBeLessThan(5000);
  });

  it("reports a database failure", async () => {
    db.upsertError = { code: "42501" };
    expect(await saveGoogleConnection({ refreshToken: "1//r", email: "g@example.com", name: null })).toBe(false);
  });
});

describe("readRefreshToken / deleteGoogleConnection", () => {
  it("returns the decrypted token for the signed-in user only", async () => {
    db.row = storedRow();
    expect(await readRefreshToken()).toBe("1//refresh");
    db.row = storedRow("user-b");
    expect(await readRefreshToken()).toBeNull();
    db.row = null;
    expect(await readRefreshToken()).toBeNull();
  });

  it("deletes by the signed-in user's id", async () => {
    expect(await deleteGoogleConnection()).toBe(true);
    expect(db.deletes).toEqual(["user-a"]);
  });
});
