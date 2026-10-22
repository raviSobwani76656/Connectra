import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt, which Supabase uses, only reads the first 72 bytes of a password.
export const PASSWORD_MAX_BYTES = 72;

const byteLength = (value: string) => new TextEncoder().encode(value).length;

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "Email address is too long.")
  .pipe(z.email("Enter a valid email address."));

// Passwords are never trimmed or otherwise changed.
const newPassword = z
  .string({ error: "Enter a password." })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine(
    (value) => byteLength(value) <= PASSWORD_MAX_BYTES,
    `Password must be at most ${PASSWORD_MAX_BYTES} characters.`,
  );

const existingPassword = z
  .string({ error: "Enter your password." })
  .min(1, "Enter your password.")
  .refine((value) => byteLength(value) <= PASSWORD_MAX_BYTES, "Invalid email or password.");

export const signUpSchema = z.object({ email, password: newPassword });
export const logInSchema = z.object({ email, password: existingPassword });
export const resendSchema = z.object({ email });

/**
 * Query parameters of the confirmation link (D-017). Only these two are read;
 * anything else, including a redirect target, is ignored.
 */
export const confirmParamsSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{8,512}$/),
  type: z.enum(["email", "signup"]),
});

/** Delete account (FR-11): current password plus the exact word DELETE. */
export const deleteAccountSchema = z.object({
  password: existingPassword,
  confirmation: z.literal("DELETE", { error: "Type DELETE in capital letters to confirm." }),
});

/** Fixed notices and reasons: query text is never shown to the user. */
export const loginNoticeSchema = z.enum(["email-confirmed", "account-deleted"]);
export const confirmErrorReasonSchema = z.enum(["expired", "invalid"]);

export type AuthFields = "email" | "password";
export type FieldErrors = Partial<Record<AuthFields, string>>;

/** Reads only the expected fields from a submitted form; anything else is ignored. */
export function readAuthForm(formData: FormData): Record<AuthFields, unknown> {
  return { email: formData.get("email"), password: formData.get("password") };
}

/** First error message per field. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
