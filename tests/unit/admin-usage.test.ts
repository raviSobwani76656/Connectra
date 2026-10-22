import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks over the source tree (CLAUDE.md, D-013, SR-05).
const ROOT = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = ["app", "lib"].flatMap((dir) => sourceFiles(join(ROOT, dir)));
const rel = (path: string) => relative(ROOT, path).split(sep).join("/");
const read = (path: string) => readFileSync(path, "utf8");

describe("admin client and secrets", () => {
  it("only app/dashboard/actions.ts imports the Supabase admin client", () => {
    const importers = files.filter((file) => /from\s+["'](@\/lib\/supabase\/admin|.*\/supabase\/admin)["']/.test(read(file)));
    expect(importers.map(rel)).toEqual(["app/dashboard/actions.ts"]);
  });

  it("SUPABASE_SERVICE_ROLE_KEY is read only by the env schema and the admin client", () => {
    const readers = files.filter((file) => read(file).includes("SUPABASE_SERVICE_ROLE_KEY"));
    expect(readers.map(rel).sort()).toEqual(["lib/env-schema.ts", "lib/supabase/admin.ts"]);
  });

  it("no client component imports secrets, the encryption module, Google code or the admin client", () => {
    const clientFiles = files.filter((file) => /^\s*["']use client["']/.test(read(file)));
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const file of clientFiles) {
      const source = read(file);
      expect(source, rel(file)).not.toMatch(/@\/lib\/(env"|crypto|google\/(oauth|connection|drive|config|http)|supabase\/(admin|server|password-check))/);
      expect(source, rel(file)).not.toMatch(/process\.env\.(SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|ENCRYPTION_KEY)/);
    }
  });

  it("modules holding secrets, crypto or the admin client start with import \"server-only\"", () => {
    for (const path of [
      "lib/env.ts",
      "lib/crypto/encryption.ts",
      "lib/google/oauth.ts",
      "lib/google/oauth-cookie.ts",
      "lib/google/connection.ts",
      "lib/google/drive.ts",
      "lib/google/config.ts",
      "lib/supabase/admin.ts",
      "lib/supabase/password-check.ts",
      "lib/supabase/server.ts",
    ]) {
      expect(read(join(ROOT, path)).startsWith('import "server-only";'), path).toBe(true);
    }
  });

  it("nothing uses 'use cache' (D-012, D-021)", () => {
    expect(files.filter((file) => /["']use cache/.test(read(file))).map(rel)).toEqual([]);
  });
});
