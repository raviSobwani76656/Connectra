// Zod schemas for everything that comes from Google or from the OAuth callback URL (SR-09).
// Unknown fields are stripped; sizes are bounded.
import { z } from "zod";

const urlSafe = /^[A-Za-z0-9_-]+$/;

/** Query parameters of GET /api/oauth/google/callback. Each is optional; the route decides. */
export const callbackQuerySchema = z.object({
  code: z.string().min(1).max(2048).regex(/^[\x21-\x7E]+$/).optional(),
  state: z.string().min(16).max(256).regex(urlSafe).optional(),
  error: z.string().min(1).max(128).regex(/^[a-z_]+$/).optional(),
});

const bearer = z.string().refine((value) => value.toLowerCase() === "bearer");

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(4096),
  expires_in: z.number().int().positive(),
  token_type: bearer,
  scope: z.string().max(2048),
  id_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(2048).optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const refreshResponseSchema = z.object({
  access_token: z.string().min(1).max(4096),
  expires_in: z.number().int().positive(),
  token_type: bearer,
  scope: z.string().max(2048).optional(),
});

export const oauthErrorSchema = z.object({
  error: z.string().max(128),
});

/** Claims we read from a verified ID token; signature, iss, aud and exp are checked by jose. */
export const idTokenClaimsSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254),
  name: z.string().trim().max(256).optional(),
  nonce: z.string().min(1).max(256),
});
export type IdTokenClaims = z.infer<typeof idTokenClaimsSchema>;

export const driveFileSchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().max(1024),
  mimeType: z.string().min(1).max(256),
  modifiedTime: z.iso.datetime({ offset: true }),
  webViewLink: z.string().max(2048).optional(),
});

export const driveListSchema = z.object({
  files: z.array(driveFileSchema).max(1000).default([]),
});

/** Google API error body, in both the classic (`errors[].reason`) and newer (`details[].reason`) shapes. */
export const driveErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    status: z.string().max(128).optional(),
    errors: z.array(z.object({ reason: z.string().max(128).optional() })).max(20).optional(),
    details: z.array(z.object({ reason: z.string().max(128).optional() })).max(20).optional(),
  }),
});
