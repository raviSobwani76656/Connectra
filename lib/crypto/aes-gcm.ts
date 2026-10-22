// AES-256-GCM with context binding (D-007). Pure: the key is passed in, so this can be
// unit-tested; application code uses lib/crypto/encryption.ts, which supplies the real key.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const CURRENT_KEY_VERSION = 1;

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BASE64URL = /^[A-Za-z0-9_-]*$/;

export type EncryptionContext = {
  userId: string;
  /** Which value this is, e.g. "refresh_token". Ciphertext cannot be moved to another field. */
  field: string;
};

/** Any failure to decrypt: wrong key, wrong user or field, tampering, or a malformed value. */
export class DecryptionError extends Error {
  constructor() {
    super("Decryption failed");
    this.name = "DecryptionError";
  }
}

function additionalData({ userId, field }: EncryptionContext): Buffer {
  return Buffer.from(`connectra:v${CURRENT_KEY_VERSION}:${userId}:${field}`, "utf8");
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error("Encryption key must be 32 bytes");
  }
}

/** Returns `v1.<iv>.<tag>.<ciphertext>`, each part base64url. A fresh random IV every call. */
export function encryptString(key: Buffer, plaintext: string, context: EncryptionContext): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(additionalData(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    `v${CURRENT_KEY_VERSION}`,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptString(key: Buffer, payload: string, context: EncryptionContext): string {
  assertKey(key);
  const parts = payload.split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== `v${CURRENT_KEY_VERSION}` ||
    !parts.slice(1).every((part) => BASE64URL.test(part))
  ) {
    throw new DecryptionError();
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new DecryptionError();
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(additionalData(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError();
  }
}
