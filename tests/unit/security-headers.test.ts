import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "@/next.config";

describe("security headers (finding L-3, D-024)", () => {
  it("applies to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  });

  it.each([
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "same-origin"],
    ["X-Content-Type-Options", "nosniff"],
  ])("sets %s: %s", (key, value) => {
    expect(SECURITY_HEADERS).toContainEqual({ key, value });
  });

  it("forbids framing, base tag hijacking and plugins via CSP", () => {
    const csp = SECURITY_HEADERS.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
