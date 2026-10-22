import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "@/app/(auth)/password-input";

// Initial-render checks only: there is no browser DOM in these tests, so clicking,
// keyboard use and reset-on-submit are covered by the manual checklist.

type Props = Parameters<typeof PasswordInput>[0];

function render(props: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    createElement(PasswordInput, {
      id: "password",
      name: "password",
      autoComplete: "current-password",
      ...props,
    }),
  );
}

/** The opening tag of the first <name> element in the markup. */
function tag(html: string, name: "input" | "button" | "svg"): string {
  const match = html.match(new RegExp(`<${name}\\b[^>]*>`));
  if (!match) throw new Error(`no <${name}> rendered`);
  return match[0];
}

/** HTML attribute names are case-insensitive; React renders some in camelCase (autoComplete). */
function attr(element: string, name: string): string | null {
  const match = element.match(new RegExp(`\\s${name}="([^"]*)"`, "i"));
  return match ? match[1] : null;
}

describe("PasswordInput initial render", () => {
  it("hides the password by default", () => {
    expect(attr(tag(render(), "input"), "type")).toBe("password");
  });

  it("renders the toggle as a non-submitting button", () => {
    expect(attr(tag(render(), "button"), "type")).toBe("button");
  });

  it("uses a fixed label with aria-pressed carrying the state", () => {
    const button = tag(render(), "button");
    expect(attr(button, "aria-label")).toBe("Show password");
    expect(attr(button, "aria-pressed")).toBe("false");
  });

  it("points the toggle at the input it controls", () => {
    const html = render({ id: "signup-password" });
    expect(attr(tag(html, "button"), "aria-controls")).toBe("signup-password");
    expect(attr(tag(html, "input"), "id")).toBe("signup-password");
  });

  it.each(["current-password", "new-password"] as const)(
    "keeps autocomplete=%s for password managers",
    (autoComplete) => {
      expect(attr(tag(render({ autoComplete }), "input"), "autocomplete")).toBe(autoComplete);
    },
  );

  it("keeps the field name used by the Server Actions", () => {
    expect(attr(tag(render(), "input"), "name")).toBe("password");
  });

  it("keeps the password out of spellcheck and autocorrect", () => {
    const input = tag(render(), "input");
    expect(attr(input, "spellcheck")).toBe("false");
    expect(attr(input, "autocapitalize")).toBe("none");
    expect(attr(input, "autocorrect")).toBe("off");
  });

  it("passes through error state for assistive technology", () => {
    const input = tag(render({ invalid: true, describedBy: "password-error" }), "input");
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe("password-error");
  });

  it("omits aria-invalid when there is no error", () => {
    expect(attr(tag(render(), "input"), "aria-invalid")).toBeNull();
  });

  it("hides the icon from screen readers", () => {
    const svg = tag(render(), "svg");
    expect(attr(svg, "aria-hidden")).toBe("true");
    expect(attr(svg, "focusable")).toBe("false");
  });

  it("never puts a password value in the markup", () => {
    expect(attr(tag(render(), "input"), "value")).toBeNull();
  });
});
