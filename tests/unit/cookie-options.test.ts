import { describe, expect, it } from "vitest";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

describe("SUPABASE_COOKIE_OPTIONS (SR-11, SEC-014)", () => {
  it("keeps session cookies away from page scripts", () => {
    expect(SUPABASE_COOKIE_OPTIONS.httpOnly).toBe(true);
  });

  it("only sends cookies on same-site requests and top-level navigations", () => {
    expect(SUPABASE_COOKIE_OPTIONS.sameSite).toBe("lax");
  });

  it("scopes cookies to the whole app", () => {
    expect(SUPABASE_COOKIE_OPTIONS.path).toBe("/");
  });
});
