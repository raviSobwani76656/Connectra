// Pure validation of environment variables. Holds no values itself and has no
// `server-only` import, so it can run from instrumentation.ts at startup and in unit tests.
// Error messages name the variable and the problem, never the value.
import { z } from "zod";

const required = z.string().trim().min(1, "is missing");

const httpsUrl = required
  .pipe(z.url("must be a valid URL"))
  .refine((value) => value.startsWith("https://"), "must start with https://");

// Zod keeps running later checks after an earlier one fails, so never assume the value parsed.
const toUrl = (value: string): URL | null => (URL.canParse(value) ? new URL(value) : null);

const appUrl = required
  .pipe(z.url("must be a valid URL"))
  .refine((value) => /^https?:\/\//.test(value), "must start with http:// or https://")
  // Cookies are Secure only on https (D-014), so plain http is allowed for localhost only.
  .refine((value) => {
    const url = toUrl(value);
    return url === null || url.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  }, "must use https:// unless the host is localhost")
  .refine((value) => {
    const url = toUrl(value);
    return url !== null && url.pathname === "/" && !url.search && !url.hash;
  }, "must be an origin only, e.g. http://localhost:3000")
  .transform((value) => toUrl(value)?.origin ?? value);

// 32 random bytes in standard base64 are always 43 characters plus one "=".
const encryptionKey = required.refine(
  (value) => /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, "base64").length === 32,
  "must be exactly 32 bytes encoded as base64",
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpsUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: required,
  ENCRYPTION_KEY: encryptionKey,
  GOOGLE_CLIENT_ID: required.refine(
    (value) => value.endsWith(".apps.googleusercontent.com"),
    "must end with .apps.googleusercontent.com",
  ),
  GOOGLE_CLIENT_SECRET: required,
  APP_URL: appUrl,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(problems: string[]) {
    super(
      "Invalid environment configuration (values are not shown):\n" +
        problems.map((problem) => `- ${problem}`).join("\n") +
        "\nCompare .env.local with .env.example.",
    );
    this.name = "EnvValidationError";
  }
}

type EnvSource = Record<string, string | undefined>;

function parseWith<T>(schema: z.ZodType<T>, source: EnvSource): T {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const problems = new Set<string>();
  for (const issue of result.error.issues) {
    const name = String(issue.path[0]);
    const missing = source[name] === undefined || source[name]?.trim() === "";
    problems.add(`${name} ${missing ? "is missing" : issue.message}`);
  }
  throw new EnvValidationError([...problems]);
}

export function parsePublicEnv(source: EnvSource): PublicEnv {
  return parseWith(publicEnvSchema, source);
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  return parseWith(serverEnvSchema, source);
}
