import { describe, expect, it } from "vitest";
import { redirectFor } from "@/lib/auth/routes";

describe("redirectFor (FR-04, AC-4.2, AC-4.3)", () => {
  it.each([
    ["/dashboard", false, "/login"],
    ["/dashboard/", false, "/login"],
    ["/dashboard/anything", false, "/login"],
    ["/dashboard", true, null],
    ["/login", true, "/dashboard"],
    ["/signup", true, "/dashboard"],
    ["/login", false, null],
    ["/signup", false, null],
    ["/", false, null],
    ["/", true, null],
  ])("%s (signed in: %s) -> %s", (pathname, isSignedIn, expected) => {
    expect(redirectFor(pathname, isSignedIn)).toBe(expected);
  });

  it("does not treat look-alike paths as protected", () => {
    expect(redirectFor("/dashboardx", false)).toBeNull();
    expect(redirectFor("/loginx", true)).toBeNull();
  });
});
