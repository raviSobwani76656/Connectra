import { describe, expect, it } from "vitest";
import {
  logInSchema,
  readAuthForm,
  signUpSchema,
  toFieldErrors,
} from "@/lib/auth/schemas";

const VALID_PASSWORD = "correct-horse-battery"; // 21 characters

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("signUpSchema (FR-01, BR-01, BR-02)", () => {
  it("accepts a valid email and password", () => {
    const result = signUpSchema.safeParse({ email: "ravi@example.com", password: VALID_PASSWORD });
    expect(result.success).toBe(true);
  });

  it("trims and lower-cases the email (BR-01)", () => {
    const result = signUpSchema.parse({ email: "  Ravi@Example.COM ", password: VALID_PASSWORD });
    expect(result.email).toBe("ravi@example.com");
  });

  it("never changes the password", () => {
    const password = "  spaces kept  ";
    expect(signUpSchema.parse({ email: "a@example.com", password }).password).toBe(password);
  });

  it.each([
    ["11 characters is rejected", "a".repeat(11), false],
    ["12 characters is accepted", "a".repeat(12), true],
    ["72 characters is accepted", "a".repeat(72), true],
    ["73 characters is rejected", "a".repeat(73), false],
  ])("password boundary: %s", (_label, password, expected) => {
    expect(signUpSchema.safeParse({ email: "a@example.com", password }).success).toBe(expected);
  });

  it("counts bytes, not characters, against the 72 limit", () => {
    // "é" is 2 bytes in UTF-8: 37 characters = 74 bytes.
    const result = signUpSchema.safeParse({ email: "a@example.com", password: "é".repeat(37) });
    expect(result.success).toBe(false);
  });

  it.each([
    ["missing", undefined],
    ["null (absent form field)", null],
    ["empty", ""],
    ["whitespace only", "   "],
    ["no @", "ravi.example.com"],
    ["no domain", "ravi@"],
    ["wrong type", 42],
    ["too long", `${"a".repeat(250)}@example.com`],
  ])("rejects an invalid email: %s", (_label, email) => {
    const result = signUpSchema.safeParse({ email, password: VALID_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).email).toBeTruthy();
    }
  });

  it("rejects a missing password with a field error", () => {
    const result = signUpSchema.safeParse({ email: "a@example.com", password: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).password).toBeTruthy();
    }
  });
});

describe("logInSchema (FR-02)", () => {
  it("accepts any non-empty password up to 72 bytes", () => {
    expect(logInSchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(logInSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });

  it("uses the generic message for an over-long password", () => {
    const result = logInSchema.safeParse({ email: "a@example.com", password: "a".repeat(73) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).password).toBe("Invalid email or password.");
    }
  });
});

describe("readAuthForm", () => {
  it("reads only email and password and ignores unexpected fields (DES-019)", () => {
    const values = readAuthForm(
      form({ email: "a@example.com", password: VALID_PASSWORD, role: "admin", user_id: "x" }),
    );
    expect(values).toEqual({ email: "a@example.com", password: VALID_PASSWORD });
  });

  it("returns null for missing fields so validation rejects them", () => {
    expect(readAuthForm(form({}))).toEqual({ email: null, password: null });
  });
});

describe("toFieldErrors", () => {
  it("keeps only the first message per field", () => {
    const result = signUpSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(Object.keys(errors).sort()).toEqual(["email", "password"]);
      expect(typeof errors.email).toBe("string");
    }
  });
});
