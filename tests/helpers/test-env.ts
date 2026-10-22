// Synthetic configuration for unit tests (TDATA-013): none of these are real credentials.
export const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  APP_URL: "http://localhost:3000",
};

export const TEST_KEY = Buffer.from(TEST_ENV.ENCRYPTION_KEY, "base64");

/** A copy of `value` without `key`. */
export function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

/** Minimal in-memory stand-in for next/headers cookies(). */
export function createCookieJar() {
  const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return {
    jar,
    store: {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
      getAll: () => [...jar.entries()].map(([name, { value }]) => ({ name, value })),
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        jar.set(name, { value, options });
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    },
  };
}

export class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}

/** Runs fn and returns the URL passed to the mocked redirect(). */
export async function redirectOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}
