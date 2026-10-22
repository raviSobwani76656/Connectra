import { describe, expect, it } from "vitest";
import { EnvValidationError, parsePublicEnv, parseServerEnv } from "@/lib/env-schema";

// Synthetic test values only (TDATA-013): none of these are real credentials.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-value",
  ENCRYPTION_KEY: TEST_KEY,
  GOOGLE_CLIENT_ID: "1234-test.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret-value",
  APP_URL: "http://localhost:3000",
};

function errorFor(source: Record<string, string | undefined>): EnvValidationError {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error("expected parseServerEnv to throw");
}

describe("parseServerEnv (SR-12)", () => {
  it("accepts a complete, valid configuration", () => {
    expect(parseServerEnv(VALID)).toMatchObject({ APP_URL: "http://localhost:3000" });
  });

  it("normalises APP_URL to an origin without a trailing slash", () => {
    expect(parseServerEnv({ ...VALID, APP_URL: "http://localhost:3000/" }).APP_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("ignores unrelated environment variables", () => {
    const parsed = parseServerEnv({ ...VALID, PATH: "/usr/bin" });
    expect(parsed).not.toHaveProperty("PATH");
  });

  it.each(Object.keys(VALID))("reports %s as missing when absent", (name) => {
    const source: Record<string, string | undefined> = { ...VALID, [name]: undefined };
    expect(errorFor(source).message).toContain(`${name} is missing`);
  });

  it.each(Object.keys(VALID))("reports %s as missing when blank", (name) => {
    expect(errorFor({ ...VALID, [name]: "   " }).message).toContain(`${name} is missing`);
  });

  it.each([
    ["too short", Buffer.alloc(16).toString("base64")],
    ["too long", Buffer.alloc(33).toString("base64")],
    ["not base64", "!".repeat(43) + "="],
    ["hex instead of base64", "ab".repeat(32)],
  ])("rejects an ENCRYPTION_KEY that is %s", (_label, value) => {
    expect(errorFor({ ...VALID, ENCRYPTION_KEY: value }).message).toContain(
      "ENCRYPTION_KEY must be exactly 32 bytes encoded as base64",
    );
  });

  it("requires https for the Supabase URL", () => {
    expect(
      errorFor({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "http://project-ref.supabase.co" }).message,
    ).toContain("NEXT_PUBLIC_SUPABASE_URL must start with https://");
  });

  it.each([
    ["with a path", "http://localhost:3000/app"],
    ["with a query", "http://localhost:3000/?x=1"],
    ["with another scheme", "ftp://localhost:3000"],
    ["not a URL", "localhost"],
  ])("rejects an APP_URL %s", (_label, value) => {
    expect(errorFor({ ...VALID, APP_URL: value }).message).toContain("APP_URL");
  });

  it("rejects a Google client ID from the wrong place", () => {
    expect(errorFor({ ...VALID, GOOGLE_CLIENT_ID: "not-a-client-id" }).message).toContain(
      "GOOGLE_CLIENT_ID must end with .apps.googleusercontent.com",
    );
  });

  it("lists every problem at once", () => {
    const message = errorFor({}).message;
    for (const name of Object.keys(VALID)) {
      expect(message).toContain(name);
    }
  });

  it("never includes secret values in the error message (SR-05, SEC-047)", () => {
    const secret = "super-secret-value-that-must-not-leak";
    const message = errorFor({
      ...VALID,
      GOOGLE_CLIENT_ID: secret,
      ENCRYPTION_KEY: secret,
      APP_URL: secret,
      NEXT_PUBLIC_SUPABASE_URL: secret,
    }).message;
    expect(message).not.toContain(secret);
  });
});

describe("parsePublicEnv", () => {
  it("needs only the two public variables", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  });

  it("does not return server secrets even if present", () => {
    const parsed = parsePublicEnv(VALID);
    expect(parsed).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(parsed).not.toHaveProperty("ENCRYPTION_KEY");
    expect(parsed).not.toHaveProperty("GOOGLE_CLIENT_SECRET");
  });
});
