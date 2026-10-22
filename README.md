# Connectra

A learning project that shows, end to end and securely, how a web app can:

1. Let people **sign up and log in** with an email address and password (with or without email confirmation).
2. Let a signed-in person **connect their Google account** on Google's own approval page. The app never sees the Google password.
3. Show that person their **Google name and email** and their **20 most recently modified Google Drive files** (name, type, last modified, "Open in Drive"). File contents are never downloaded or stored.
4. **Disconnect** Google (revoking access at Google) and **delete the account** with all stored data.

Localhost only. Requirements: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md). Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Setup on Windows

You need **Node.js 20.9 or later** (developed on Node 24) and **npm**, a **Supabase** project and a **Google Cloud** project. Use PowerShell for the commands below.

### 1. Install

```powershell
git clone <this repository>
cd connectra
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com). Note its region; this project uses Singapore (`ap-southeast-1`), so data is stored outside India.
2. **SQL Editor → New query:** paste all of [`supabase/migrations/0001_google_connections.sql`](supabase/migrations/0001_google_connections.sql) and click **Run**. This creates the `google_connections` table, its row-level security policies and the cascade delete. Then run `notify pgrst, 'reload schema';`.
   - Check in **Table Editor** that `google_connections` shows **RLS enabled**.
   - If the dashboard later says "Couldn't load your Google Drive connection" and the dev log shows `code=PGRST205`, this step was missed.
3. **Authentication → Sign In / Providers → Email:**
   - Set **Minimum password length** to **12**.
   - Set **Confirm email** **off** (development default, D-005) or **on**. See [Email confirmation: both modes](#email-confirmation-both-modes).
4. **Authentication → URL Configuration → Site URL:** `http://localhost:3000`.
5. **Authentication → Emails → Templates → Confirm signup** (needed only when Confirm email is on): set the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Don't add a `next` parameter.
6. **Project Settings → API / API Keys:** you'll need the **project URL**, the **anon (publishable)** key and the **service-role (secret)** key.

### 3. Google Cloud

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library → Google Drive API → Enable.** Without this, files fail to load; the dev log then shows `reason=accessNotConfigured` with a hint.
3. **Google Auth Platform / OAuth consent screen:**
   - User type **External**, publishing status **Testing**.
   - Add your Google account under **Test users**.
   - Add the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` and `https://www.googleapis.com/auth/drive.metadata.readonly`.
4. **Credentials → Create credentials → OAuth client ID:**
   - Type **Web application**.
   - **Authorized redirect URI:** exactly `http://localhost:3000/api/oauth/google/callback`.
   - Copy the **client ID** and **client secret**.

### 4. `.env.local`

Copy the template and fill it in. Each variable in [`.env.example`](.env.example) has a comment saying where to find it.

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Generate `ENCRYPTION_KEY` (32 random bytes, base64) in PowerShell and paste the output:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

`.env.local` is git-ignored. Never commit it. The server refuses to start if a variable is missing or malformed, and names the variable (never its value).

| Variable | Secret? | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (protected by RLS) | Supabase calls as the signed-in user |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Account deletion only |
| `ENCRYPTION_KEY` | **Yes** | AES-256-GCM encryption of stored Google data |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | **Yes** | Google OAuth code exchange and token refresh |
| `APP_URL` | No | Builds the OAuth redirect URI (`http://localhost:3000`) |

---

## Run and test

```powershell
npm run dev          # http://localhost:3000
npm test             # unit tests (Vitest, no network)
npm run lint
npx tsc --noEmit     # type-check
npm run build
```

- The development log is mirrored to `.next/dev/logs/next-development.log`. App lines start with `[auth]` and contain only error codes, HTTP status and Google error reasons. They never contain emails, names, file names, tokens or passwords.
- The manual test checklists for P1 and P2 are in the project history (Phase 3 and Phase 4 checkpoints) and summarised by the acceptance criteria in the brief.

### Email confirmation: both modes

The app works with Supabase's **Confirm email** on or off (D-017).

| | Confirm email **off** | Confirm email **on** |
|---|---|---|
| Sign up | Signed in and sent to `/dashboard` | "Check your email" screen |
| Existing email at sign-up | "An account with this email already exists" (limitation L-02) | The same "Check your email" screen (no account enumeration) |
| Confirmation link | Not used | `/auth/confirm` verifies it, then sends you to `/login` with "Your email is confirmed". You log in yourself; a link never leaves the browser signed in (D-023). |
| Log in before confirming | Not applicable | "Please confirm your email address first", with resend (only after a correct password, D-018) |

Things to know when testing **on** mode:
- Supabase's built-in email sender allows only about **2 emails per hour per project** (L-08).
- The same user can be emailed at most once every **60 seconds**; the resend button is locked for 60 s.
- Email scanners such as Outlook Safe Links may use up the link before you click it (L-07). Use **Resend** on the error page.
- A stuck unconfirmed test user can be deleted in **Authentication → Users**.

---

## Architecture

A **Next.js 16 full-stack modular monolith** (App Router, TypeScript, Tailwind) on **Supabase** (Auth + Postgres). See D-002 for the scored comparison with a separate Fastify API.

```
Browser ──► proxy.ts (refreshes session cookie, quick redirect)
        ──► Pages / Server Actions / Route Handlers   (all re-check the user with requireUser())
               │
               ├── lib/auth        session check (getClaims), Zod schemas, redirect rules
               ├── lib/supabase    per-request client (RLS applies) · admin client (delete account only)
               ├── lib/crypto      AES-256-GCM, random 12-byte IV, AAD = user id + field, key version
               ├── lib/google      OAuth (PKCE + state + nonce, ID token verified with jose),
               │                   sealed OAuth cookie, token refresh, Drive files.list, formatting
               └── lib/env         startup validation of all environment variables
        Supabase Postgres: google_connections (one row per user, encrypted values, RLS, ON DELETE CASCADE)
        Google: accounts.google.com · oauth2.googleapis.com · www.googleapis.com/drive/v3
```

| Area | How it works | Decision |
|---|---|---|
| Sessions | Supabase Auth, httpOnly `SameSite=Lax` cookies via `@supabase/ssr`. `proxy.ts` refreshes them; `requireUser()` is the authoritative check. | D-004 |
| Changes | Sign-up, log-in, log-out, disconnect and delete are Server Actions (POST, origin-checked). | D-013 |
| Google connection | Hand-written authorization-code flow with PKCE, state and nonce. The state cookie is sealed with AES-GCM and bound to the user. `prompt=consent` makes Google return a refresh token every time. | D-009, D-020 |
| Stored data | Only the **refresh token**, the Google **email** and the Google **name**, each AES-256-GCM encrypted. Access tokens, ID tokens and file lists are never stored. | D-007, D-008 |
| Drive list | Fetched on each dashboard load or Refresh (no caching). One retry after a 401. A 403 is split into permission (reconnect), quota (temporary) and API-disabled (configuration). | D-019, D-022 |
| Dashboard | Header, banner and danger zone render at once; the Google section streams in behind `<Suspense>`. Responses are `no-store`. | D-021, D-012 |
| Hardening | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `nosniff` and `Referrer-Policy` on every response. `APP_URL` must be https outside localhost. | D-024 |
| Account deletion | Re-check the password, revoke at Google, `auth.admin.deleteUser`; the row goes by cascade. | D-013 |

---

## Known limitations and shortcuts

| ID | Limitation |
|---|---|
| L-01 | While the Google consent screen is in **Testing**, Google expires refresh tokens after about 7 days. The user then sees "expired, please reconnect" once. |
| L-02 | With Confirm email **off**, sign-up reveals whether an email already has an account, and anyone can register any address. |
| L-03 | `drive.metadata.readonly` is a restricted scope. Publishing the app would need Google verification and a security assessment. |
| L-04 | No app-level rate limiting; relies on Supabase Auth's built-in limits. |
| L-05 | A user can read or overwrite **their own** encrypted row through Supabase's API. They only get ciphertext; tampering shows as "expired". |
| L-06 | Data is stored in Singapore (outside India). Data residency must be assessed before any production use. |
| L-07 | Email scanners can use up one-time confirmation links. |
| L-08 | Supabase's built-in email sender sends about 2 emails per hour. |
| — | "Expired" (State C) is shown once; later visits show "Connect Google Drive" (D-021). |
| — | After logout, a stolen access token could still pass a local JWT check until it expires (≤ 1 hour). Normal logout deletes the cookies. |
| — | Localhost only: cookies are not `Secure` on `http://localhost` (they are when `APP_URL` is https, which is required on any other host). |
| — | No full Content-Security-Policy yet (only anti-framing directives); needed before any deployment (D-024). |
| — | Supabase Auth's per-IP limits see the server's IP, not each visitor's; app-side throttling is needed before any deployment (security finding L-2). |

**Testing-standard exceptions** (Tier 2, approved by Ravi; see brief section 7.1):
- EXC-01: one person holds every role.
- EXC-02: no independent human reviewer.
- EXC-03: no CI pipeline.
- EXC-04: no dynamic scan or penetration test.
- EXC-05: requirement-to-test traceability only.
- EXC-06: no legal or privacy review.
- EXC-07: brute-force protection is Supabase's own.

## Project documents

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md): requirements (FR, NFR, DATA, SR IDs), acceptance criteria, data handling, risks, traceability.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decision records D-001 to D-022.
- [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md): instructions for AI coding assistants.
- [`docs/STANDARD_IT_TESTING_RULES.md`](docs/STANDARD_IT_TESTING_RULES.md), [`docs/Architecture_Decision_Framework.md`](docs/Architecture_Decision_Framework.md): team standards.
