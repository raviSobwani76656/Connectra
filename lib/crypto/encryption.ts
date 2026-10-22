import "server-only";
import { getServerEnv } from "@/lib/env";
import {
  CURRENT_KEY_VERSION,
  DecryptionError,
  decryptString,
  encryptString,
  type EncryptionContext,
} from "./aes-gcm";

export { CURRENT_KEY_VERSION, DecryptionError };
export type EncryptedField = "refresh_token" | "google_email" | "google_name" | "oauth-state";

let key: Buffer | undefined;

function getKey(): Buffer {
  // ENCRYPTION_KEY is validated at startup as exactly 32 bytes of base64 (lib/env-schema.ts).
  key ??= Buffer.from(getServerEnv().ENCRYPTION_KEY, "base64");
  return key;
}

function context(userId: string, field: EncryptedField): EncryptionContext {
  return { userId, field };
}

export function encryptForUser(userId: string, field: EncryptedField, plaintext: string): string {
  return encryptString(getKey(), plaintext, context(userId, field));
}

/** Throws DecryptionError if the value was tampered with, belongs to another user or field, or the key is wrong. */
export function decryptForUser(userId: string, field: EncryptedField, payload: string): string {
  return decryptString(getKey(), payload, context(userId, field));
}
