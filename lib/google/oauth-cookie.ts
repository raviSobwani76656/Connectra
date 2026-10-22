import "server-only";
import { z } from "zod";
import { decryptForUser, encryptForUser } from "@/lib/crypto/encryption";
import { OAUTH_COOKIE_MAX_AGE_SECONDS } from "./config";

/** Values that must survive the round trip to Google. Sealed in one cookie (D-020). */
export type OAuthFlow = {
  state: string;
  nonce: string;
  codeVerifier: string;
  userId: string;
  issuedAt: number;
};

const sealedSchema = z.object({
  s: z.string().min(16).max(256),
  n: z.string().min(16).max(256),
  v: z.string().min(43).max(128),
  u: z.string().min(1).max(255),
  t: z.number().int().positive(),
});

const CLOCK_SKEW_MS = 60_000;

export function sealOAuthFlow(flow: OAuthFlow): string {
  const payload = JSON.stringify({
    s: flow.state,
    n: flow.nonce,
    v: flow.codeVerifier,
    u: flow.userId,
    t: flow.issuedAt,
  });
  return encryptForUser(flow.userId, "oauth-state", payload);
}

/**
 * Opens the cookie for the **current** user. Returns null if it is missing, tampered with,
 * created for another user, malformed, or older than 10 minutes.
 */
export function openOAuthFlow(sealed: string | undefined, currentUserId: string, nowMs: number): OAuthFlow | null {
  if (!sealed || sealed.length > 4096) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(decryptForUser(currentUserId, "oauth-state", sealed));
  } catch {
    return null;
  }
  const parsed = sealedSchema.safeParse(raw);
  if (!parsed.success || parsed.data.u !== currentUserId) {
    return null;
  }
  const age = nowMs - parsed.data.t;
  if (age > OAUTH_COOKIE_MAX_AGE_SECONDS * 1000 || age < -CLOCK_SKEW_MS) {
    return null;
  }
  return {
    state: parsed.data.s,
    nonce: parsed.data.n,
    codeVerifier: parsed.data.v,
    userId: parsed.data.u,
    issuedAt: parsed.data.t,
  };
}
