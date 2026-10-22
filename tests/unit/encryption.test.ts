import { describe, expect, it, vi } from "vitest";
import { CURRENT_KEY_VERSION, DecryptionError, decryptString, encryptString } from "@/lib/crypto/aes-gcm";
import { TEST_ENV, TEST_KEY } from "../helpers/test-env";

vi.mock("@/lib/env", () => ({ getServerEnv: () => TEST_ENV }));

const CTX = { userId: "user-a", field: "refresh_token" };
const SECRET = "1//synthetic-refresh-token";

function tamper(payload: string, index: 1 | 2 | 3): string {
  const parts = payload.split(".");
  const bytes = Buffer.from(parts[index], "base64url");
  bytes[0] ^= 0x01;
  parts[index] = bytes.toString("base64url");
  return parts.join(".");
}

describe("AES-256-GCM encryption (D-007, SR-03, SR-04)", () => {
  it("round-trips text, including non-ASCII", () => {
    for (const text of [SECRET, "Ravi Sobwani", "रवि", ""]) {
      expect(decryptString(TEST_KEY, encryptString(TEST_KEY, text, CTX), CTX)).toBe(text);
    }
  });

  it("produces different ciphertext every time (fresh random IV)", () => {
    const outputs = new Set(Array.from({ length: 20 }, () => encryptString(TEST_KEY, SECRET, CTX)));
    expect(outputs.size).toBe(20);
    const ivs = new Set([...outputs].map((value) => value.split(".")[1]));
    expect(ivs.size).toBe(20);
  });

  it("stores the key version and a 12-byte IV and 16-byte tag", () => {
    const [version, iv, tag] = encryptString(TEST_KEY, SECRET, CTX).split(".");
    expect(version).toBe(`v${CURRENT_KEY_VERSION}`);
    expect(CURRENT_KEY_VERSION).toBe(1);
    expect(Buffer.from(iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(tag, "base64url")).toHaveLength(16);
  });

  it("never contains the plaintext", () => {
    const payload = encryptString(TEST_KEY, SECRET, CTX);
    expect(payload).not.toContain(SECRET);
    expect(Buffer.from(payload.split(".")[3], "base64url").toString("utf8")).not.toContain(SECRET);
  });

  it.each([1, 2, 3] as const)("detects tampering with part %i (IV, tag, ciphertext)", (index) => {
    const payload = encryptString(TEST_KEY, SECRET, CTX);
    expect(() => decryptString(TEST_KEY, tamper(payload, index), CTX)).toThrow(DecryptionError);
  });

  it("fails for another user's id (no copying between accounts)", () => {
    const payload = encryptString(TEST_KEY, SECRET, CTX);
    expect(() => decryptString(TEST_KEY, payload, { ...CTX, userId: "user-b" })).toThrow(DecryptionError);
  });

  it("fails for another field name (no copying between fields)", () => {
    const payload = encryptString(TEST_KEY, SECRET, CTX);
    expect(() => decryptString(TEST_KEY, payload, { ...CTX, field: "google_email" })).toThrow(DecryptionError);
  });

  it("fails with the wrong key", () => {
    const payload = encryptString(TEST_KEY, SECRET, CTX);
    expect(() => decryptString(Buffer.alloc(32, 9), payload, CTX)).toThrow(DecryptionError);
  });

  it.each([
    ["empty", ""],
    ["plain text", SECRET],
    ["wrong version", "v2.AAAA.AAAA.AAAA"],
    ["too few parts", "v1.AAAA.AAAA"],
    ["bad characters", "v1.!!!!.AAAA.AAAA"],
    ["short IV", `v1.${Buffer.alloc(8).toString("base64url")}.${Buffer.alloc(16).toString("base64url")}.AA`],
  ])("rejects a malformed value: %s", (_label, payload) => {
    expect(() => decryptString(TEST_KEY, payload, CTX)).toThrow(DecryptionError);
  });

  it("refuses keys that are not 32 bytes", () => {
    expect(() => encryptString(Buffer.alloc(16), SECRET, CTX)).toThrow(/32 bytes/);
  });
});

describe("encryptForUser / decryptForUser (uses ENCRYPTION_KEY)", () => {
  it("binds to the user and field", async () => {
    const { decryptForUser, encryptForUser } = await import("@/lib/crypto/encryption");
    const payload = encryptForUser("user-a", "google_email", "a@example.com");
    expect(decryptForUser("user-a", "google_email", payload)).toBe("a@example.com");
    expect(() => decryptForUser("user-b", "google_email", payload)).toThrow(DecryptionError);
    expect(() => decryptForUser("user-a", "google_name", payload)).toThrow(DecryptionError);
  });
});
