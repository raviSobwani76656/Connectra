# Project Decisions

> Purpose: Record important technical and architectural decisions so that developers
> and AI coding assistants can understand what has been decided, why it was decided,
> and what constraints must be respected.
>
> This is a project convention, not a special built-in Claude Code file format.

## How to Use This File

- Record decisions that meaningfully affect architecture, security, data, dependencies,
  deployment, maintainability, cost, or future implementation.
- Keep entries concise, specific, and understandable.
- Record the decision and its reasoning, not just the chosen technology.
- Use `Accepted` while a decision is still under discussion.
- Use `Accepted` only after the decision is actually approved.
- Use `Rejected` for options considered but not selected, when that context is useful.
- Do not guess missing facts or mark assumptions as approved decisions.
- If a decision changes, do not silently rewrite history. Add a new decision that
  supersedes the old one and link the entries.
- Update the index below when adding a decision.
- Keep implementation details that can be discovered from the code out of this file
  unless they explain an important constraint or rationale.

## Status Definitions

- **Accepted** — Suggested, but not approved.
- **Accepted** — Approved and currently in effect.
- **Rejected** — Considered but not selected.
- **Superseded** — Replaced by a later decision. Link the newer decision.
- **Deprecated** — No longer recommended; migration or removal may be pending.

## Decision Index

| ID | Title | Status | Date | Supersedes / Superseded by |
|---|---|---|---|---|
| D-001 | Backend Framework | Superseded | Not recorded | Superseded by D-002 |
| D-002 | Architecture: Next.js full-stack modular monolith | Accepted | 2026-10-22 | Supersedes D-001 |
| D-003 | Scope change: read-only Drive metadata and a stored refresh token | Accepted | 2026-10-22 | — |
| D-004 | Authentication: Supabase Auth with cookie sessions | Accepted | 2026-10-22 | — |
| D-005 | Development sign-up policy: no email confirmation, 12–72 character passwords | Accepted | 2026-10-22 | — |
| D-006 | Data model: one encrypted Google connection row per user, with row-level security | Accepted | 2026-10-22 | — |
| D-007 | Encryption: AES-256-GCM with bound context and key versioning | Accepted | 2026-10-22 | — |
| D-008 | Store only the encrypted Google refresh token, never access tokens | Accepted | 2026-10-22 | — |
| D-009 | Google OAuth: hand-written authorization code flow with PKCE, state and nonce | Accepted | 2026-10-22 | — |
| D-010 | Google Drive scope: drive.metadata.readonly in Google testing mode | Accepted | 2026-10-22 | — |
| D-011 | Drive file list fetched per request, never stored or cached | Accepted | 2026-10-22 | — |
| D-012 | Turn off Cache Components and Partial Prefetching | Accepted | 2026-10-22 | — |
| D-013 | State-changing actions as Server Actions; admin client only for account deletion | Accepted | 2026-10-22 | — |
| D-014 | Localhost only; data stored in Singapore | Accepted | 2026-10-22 | — |
| D-015 | Test runner and new dependencies: Vitest and jose | Accepted | 2026-10-22 | — |

---

## Decisions

### D-001: Backend Framework

**Status:** Superseded by D-002 (2026-10-22)

**Decision:** Use Fastify with TypeScript.

**Why:** We want a lightweight API framework with request validation and good performance.

**Alternatives:** Express, NestJS.

---

### D-002: Architecture — Next.js Full-Stack Modular Monolith

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Build Connectra as one Next.js 16 application (App Router, TypeScript), organised
as a modular monolith. Pages and Server Components render the UI. Route Handlers serve the
Google OAuth start and callback endpoints. Server Actions handle form submissions and
state-changing actions. Server-only modules under `lib/` hold auth, data access, encryption,
Google and configuration logic. Supabase provides authentication and Postgres. There is no
separate API server.

**Why:** Scored against `docs/Architecture_Decision_Framework.md` using its illustrative
weights unchanged. Mandatory security and privacy requirements (PROJECT_BRIEF section 5,
SR-01 to SR-13) were applied as pass/fail gates first.

| Criterion | Weight | A: Next.js full-stack | B: Fastify API + separate frontend |
|---|---|---|---|
| Security gate (SR-01–SR-13 achievable) | Pass/fail | **Pass** | **Pass** |
| Security and compliance | 20% | 4: one origin, httpOnly same-site cookies, built-in origin check on Server Actions, `server-only` guard | 3: cross-origin cookies, CORS and CSRF on the API must be configured by hand |
| Maintainability | 20% | 4: one codebase, one set of conventions, one build | 3: two apps plus an API contract to keep in sync |
| Reliability and availability | 15% | 3: depends on Supabase and Google | 3: same dependencies, plus one more process |
| Performance | 15% | 4: server rendering with direct data access | 3: an extra network hop between frontend and API |
| Scalability | 10% | 4: stateless servers scale horizontally | 5: API and frontend can scale independently |
| Development and operational cost | 10% | 5: project already exists; one thing to run | 2: second project, extra setup and learning |
| Integration flexibility | 10% | 4: Route Handlers call Google directly | 4: equivalent |
| **Weighted score (out of 100)** | | **79** | **64** |

Calculation: A = 16 + 16 + 9 + 12 + 8 + 10 + 8 = 79; B = 12 + 12 + 9 + 9 + 10 + 4 + 8 = 64.

**Alternatives:** Fastify API + separate frontend (option B above; this is D-001's choice):
rejected because it scores lower on every criterion except scalability, and its scalability
advantage is not needed now. Express and NestJS (listed in D-001) were not scored separately;
they share option B's two-application trade-offs.

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Whole application.

**Related decisions:** D-004, D-012, D-013

**Supersedes:** D-001.

**Consequences:** Simpler to learn, build and run. Server and client code share one
repository, so code holding secrets can accidentally end up in client code; this is mitigated by
`import "server-only"` (D-013). The API cannot be scaled separately from the UI without a later
split.

**Implementation Guidance:** Keep modules separated by responsibility (`lib/auth`, `lib/db`,
`lib/crypto`, `lib/google`, `lib/env`). Never import server-only modules from `"use client"` files.

**Validation:** Build succeeds with `server-only` guards in place; code review against SR-05.

**Open Questions:** None.

---

### D-003: Scope Change — Read-only Drive Metadata and a Stored Refresh Token

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Change the project scope recorded in `CLAUDE.md`. The previous scope requested
`openid email profile` only, stored no refresh token, and excluded Drive access. The new scope
adds `https://www.googleapis.com/auth/drive.metadata.readonly`, stores an encrypted Google
refresh token (D-008), and lists the 20 most recent Drive items' metadata (D-011). File contents,
Box, search and deployment remain out of scope.

**Why:** The approved requirements (PROJECT_BRIEF FR-07, FR-09) need Drive file metadata and a
connection that persists across sign-ins. Both are impossible under the old scope.

**Alternatives:** Keep the old scope (no Drive list, reconnect every session). Rejected because
it fails FR-07 and FR-09.

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `CLAUDE.md` project scope section; Google integration.

**Related decisions:** D-008, D-010, D-011

**Supersedes:** None. `CLAUDE.md` is not a decision record; its scope text is updated once this is Accepted.

**Consequences:** More sensitive data is held (a long-lived credential), which increases the
importance of D-007 and D-013.

**Implementation Guidance:** Update the `CLAUDE.md` "Project scope" section to match this
decision before P2 work starts.

**Validation:** `CLAUDE.md` and PROJECT_BRIEF agree; the Google consent screen shows only the three scopes.

**Open Questions:** None.

---

### D-004: Authentication — Supabase Auth with Cookie Sessions

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Use Supabase Auth email and password sign-in. Sessions are stored in httpOnly
cookies through `@supabase/ssr` (`createServerClient` with the `getAll`/`setAll` cookie methods).
A root `proxy.ts` (the Next 16 replacement for `middleware.ts`) refreshes the session and
redirects signed-out visitors away from `/dashboard` as a quick first check. The authoritative
check is a server-only data-access function, `requireUser()`, which calls
`supabase.auth.getClaims()` and is used by every protected page, Server Action and Route Handler.

**Why:** Passwords are hashed and rate-limited by a managed service instead of hand-written code.
Cookie sessions keep tokens out of page scripts. The Next docs advise against relying on
proxy alone, so the check is repeated close to the data.

**Alternatives:** A hand-written password store (rejected: high risk of mistakes); Auth.js
(rejected: adds a second auth system next to Supabase's row-level security).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Sign up, log in, log out, route protection.

**Related decisions:** D-005, D-006, D-013

**Supersedes:** None

**Consequences:** Session lifetime and attempt rate limits follow Supabase defaults (PROJECT_BRIEF A-03, L-04).

**Implementation Guidance:** Never trust `getSession()` on the server; use `getClaims()`. Proxy
must exclude static assets. Pages that read the session render dynamically.

**Validation:** Unit tests for the redirect rules; manual signed-out and Back-button tests (AC-3.2, AC-4.2).

**Open Questions:** None.

---

### D-005: Development Sign-up Policy — No Email Confirmation, 12–72 Character Passwords

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Turn off "Confirm email" in Supabase Auth for development. Set the minimum
password length to 12 in Supabase and enforce 12–72 characters in the app's validation.

**Why:** Confirmation emails slow down local testing, and Supabase's built-in email sender is
heavily rate-limited. 12 characters is well above Supabase's default of 6. 72 is the bcrypt
input limit.

**Alternatives:** Confirmation on (rejected for development: slow, rate-limited); keep the default minimum of 6 (rejected: weak).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Sign-up.

**Related decisions:** D-004

**Supersedes:** None

**Consequences:** **Known limitation (L-02):** with confirmation off, signing up with an existing
email reveals that the account exists (account enumeration), and anyone can register any
address. Acceptable for localhost only.

**Implementation Guidance:** Login errors use one generic message for wrong password and unknown email.

**Validation:** Validation unit tests at 11, 12, 72 and 73 characters.

**Open Questions:** Revisit before any production use: turn on confirmation and use custom SMTP.

---

### D-006: Data Model — One Encrypted Google Connection Row per User, with Row-Level Security

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** One table, `public.google_connections`:
- `user_id`: primary key, referencing `auth.users(id)` `on delete cascade`.
- Encrypted text columns for the refresh token, Google email and Google name.
- `key_version`, `created_at` and `updated_at`.

Row-level security is on, with select, insert, update and delete policies limited to
`auth.uid() = user_id`. No other tables hold user data. Application reads and writes use the
signed-in user's own session, so row-level security applies.

**Why:** BR-03 allows one connection per user, so the user ID is a natural key. The cascade
makes account deletion remove everything (SR-13). Row-level security enforces SR-01 inside the
database, not only in application code.

**Alternatives:** A Postgres `security definer` function plus a schema hidden from the API, so
the table cannot be reached directly. Rejected for now as more complex to learn; see Consequences.

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Database.

**Related decisions:** D-007, D-013

**Supersedes:** None

**Consequences:** **Accepted limitation (L-05):** a user can read or overwrite **their own** row
directly through Supabase's API with their own session. They get only ciphertext. Tampering is
detected by D-007 and treated as "not connected". No user can reach another user's row.

**Implementation Guidance:** Revoke all privileges for the `anon` role; grant to `authenticated`
only what the policies need. Every policy uses `(select auth.uid())`.

**Validation:** Manual second-user test (SR-01); SQL review; inspect stored rows (SR-03).

**Open Questions:** None.

---

### D-007: Encryption — AES-256-GCM with Bound Context and Key Versioning

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Encrypt each sensitive value with AES-256-GCM using Node's built-in `crypto`:
- A fresh random 12-byte IV for every encryption.
- A 16-byte authentication tag.
- Additional authenticated data (AAD) of `connectra:v1:<user_id>:<field_name>`.

The key is `ENCRYPTION_KEY`: 32 random bytes, base64-encoded, decoded and length-checked at
startup. Stored format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url-encoded. A
`key_version` column records which key was used.

**Why:** It meets the CLAUDE.md requirement. Authenticated encryption detects tampering. The AAD
stops a value being copied to another user or field (SR-04). Versioning allows key rotation later
(R-01). Using Node's built-in crypto avoids home-made primitives (testing rules, SEC-038).

**Alternatives:** Supabase Vault or pgsodium (rejected: the key would sit next to the data, and
pgsodium is deprecated in Supabase); application-level AES-CBC + HMAC (rejected: more ways to get it wrong).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `lib/crypto`, `google_connections` columns.

**Related decisions:** D-006, D-008

**Supersedes:** None

**Consequences:** Losing the key makes stored Google data unreadable (the user reconnects).
Leaking the key exposes stored values. The key is never logged.

**Implementation Guidance:** Module starts with `import "server-only"`. Never reuse an IV. On
decryption failure, return "not connected", not an error page.

**Validation:** Unit tests: round trip; two encryptions of the same input differ; a changed IV,
tag, ciphertext or AAD is rejected; a wrong key is rejected; a malformed or missing key fails at startup.

**Open Questions:** None.

---

### D-008: Store Only the Encrypted Google Refresh Token, Never Access Tokens

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Store the Google refresh token, encrypted (D-007). For each dashboard load, exchange
it for a short-lived access token in memory and discard the access token afterwards. Never
store the access token, ID token or the Drive file list.

**Why:** FR-09 needs a persistent connection. Storing only the refresh token keeps the amount
of stored credentials to a minimum (DATA-04).

**Alternatives:** Also store and reuse the access token until it expires (rejected: one more
stored secret for a small speed gain); store nothing and reconnect every session (rejected: fails FR-09).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Google integration.

**Related decisions:** D-003, D-007, D-009, D-011

**Supersedes:** None

**Consequences:** One token request to Google per dashboard load. An `invalid_grant` response
means the token was revoked or expired: delete the row and show "Connect Google Drive" (BR-08).

**Implementation Guidance:** Use a 10-second timeout on every Google call (NFR-06). Never log token values or Google error bodies.

**Validation:** Unit tests for `invalid_grant` handling; manual revoke test.

**Open Questions:** None.

---

### D-009: Google OAuth — Hand-Written Authorization Code Flow with PKCE, State and Nonce

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Two Route Handlers.

`GET /api/oauth/google/start`:
- Requires a signed-in user.
- Creates a random `state`, a PKCE code verifier (sent to Google as an S256 challenge) and a `nonce`.
- Stores them in httpOnly cookies (`SameSite=Lax`, `Path=/api/oauth/google`, 10-minute max age; `Secure` outside localhost).
- Redirects to Google with `response_type=code`, the three scopes, `access_type=offline` and `prompt=consent`.

`GET /api/oauth/google/callback`:
- Requires the same signed-in user.
- Validates the query with Zod and handles `error=access_denied` (the user cancelled).
- Compares `state` in constant time, then clears the temporary cookies.
- Exchanges the code with the verifier.
- Verifies the ID token with `jose` against Google's published keys: signature, `iss` (`https://accounts.google.com` or `accounts.google.com`), `aud` = our client ID, `exp`, and `nonce`.
- Checks the granted scopes include `drive.metadata.readonly`.
- Requires a refresh token.
- Then encrypts and stores (D-006, D-007).

**Why:** It's a learning project, so writing the flow by hand makes each protection visible.
State stops forged callbacks (CSRF); PKCE stops a stolen code being used; the nonce stops an ID
token being replayed. `prompt=consent` makes Google return a refresh token on every connect, not
only the first. This meets SR-07 and testing rule SEC-012.

**Alternatives:** Supabase's built-in Google sign-in (rejected: it would make Google a way to
log in, not a connected account, and it doesn't keep the Drive refresh token for us);
`google-auth-library` (rejected: much larger than needed; `jose` covers verification).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `app/api/oauth/google/*`, `lib/google`.

**Related decisions:** D-008, D-010, D-015

**Supersedes:** None

**Consequences:** More code to own and test than a library. Requires installing `jose` (D-015).

**Implementation Guidance:** The redirect URI is built from `APP_URL` and must exactly match
`http://localhost:3000/api/oauth/google/callback`. Never redirect to a URL taken from the query
string. Error pages are generic.

**Validation:** Unit tests: missing or mismatched state; missing verifier cookie; wrong nonce,
audience, issuer or expiry; missing refresh token; missing scope; user cancelled. Manual
cancelled-approval test (AC-5.2).

**Open Questions:** None.

---

### D-010: Google Drive Scope — drive.metadata.readonly in Google Testing Mode

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Request only `openid`, `email`, `profile` and
`https://www.googleapis.com/auth/drive.metadata.readonly`. Keep the Google OAuth consent screen
in **Testing** status, with Ravi's account on the test-user list.

**Why:** This is the narrowest scope that lists file names, types and modified times without
access to contents (SR-08, PRIV-003).

**Alternatives:** `drive.readonly` (rejected: includes file contents); `drive.file` (rejected:
only shows files the app itself created or opened, so it can't list recent files).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Google integration.

**Related decisions:** D-003, D-009

**Supersedes:** None

**Consequences:**
- **Known limitation (L-01):** in Testing status with an External user type, Google expires
  refresh tokens after about 7 days, so the connection persists for up to 7 days.
- **Known limitation (L-03):** `drive.metadata.readonly` is a *restricted* scope. Publishing the
  app would require Google verification and a security assessment.

**Implementation Guidance:** Handle the 7-day expiry through the `invalid_grant` path (D-008).

**Validation:** The Google consent screen shows only these permissions.

**Open Questions:** None.

---

### D-011: Drive File List Fetched per Request, Never Stored or Cached

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** On each dashboard load, call Drive `files.list` with:
- `q=trashed = false`
- `orderBy=modifiedTime desc`
- `pageSize=20`
- `corpora=user`
- `fields=files(id,name,mimeType,modifiedTime)`

Validate the response with Zod, map MIME types to friendly labels (BR-06), and format dates in
Asia/Kolkata (BR-07). Do not store the list in the database, logs or any server cache.

**Why:** DATA-04 and minimal data handling. Requesting only the four fields we display keeps the
data received from Google to a minimum.

**Alternatives:** Store a copy of the list (rejected: stores personal data for no requirement).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `lib/google/drive`, dashboard.

**Related decisions:** D-008, D-012

**Supersedes:** None

**Consequences:** Each dashboard load makes two Google calls, one for the token and one for the list.

**Implementation Guidance:** Never log file names. Use a 10-second timeout; on failure show a retryable error (AC-7.3).

**Validation:** Unit tests for response validation, labels and date formatting; NFR-05 measured manually.

**Open Questions:** None.

---

### D-012: Turn Off Cache Components and Partial Prefetching

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Remove `cacheComponents: true` and `partialPrefetching: true` from
`next.config.ts`. Leave `experimental.agentFeedback` and the Tailwind Turbopack rule unchanged.

**Why:** Ravi chose simplicity for learning. With Cache Components on, every session read must
sit inside `<Suspense>`, and server-side `"use cache"` could keep personal data in memory.
`partialPrefetching` requires Cache Components (`next dev` and `next build` throw without it),
so it must be removed too.

**Alternatives:** Keep both on and wrap authenticated UI in `<Suspense>` (rejected by owner for simplicity).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `next.config.ts`; rendering model.

**Related decisions:** D-002, D-011

**Supersedes:** None

**Consequences:** Pages that read cookies render dynamically on each request, which is what we
want for personal data. We lose prefetching optimisations that this app doesn't need.

**Implementation Guidance:** Do not use `"use cache"` anywhere.

**Validation:** `npm run build` succeeds; the build output shows the dashboard as dynamic.

**Open Questions:** None.

---

### D-013: State-Changing Actions as Server Actions; Admin Client Only for Account Deletion

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:**
- **Server Actions:** sign up, log in, log out, disconnect Google and delete account are POST
  form submissions, which get Next's built-in origin check. No state changes on GET routes
  except the OAuth callback, which is protected by state.
- **Admin client:** the Supabase admin client (`SUPABASE_SERVICE_ROLE_KEY`) is created in a
  single `server-only` module used **only** by delete-account.
- **Delete account:** re-verify the password with a throwaway client that keeps no session;
  attempt Google revocation; call `auth.admin.deleteUser(id)`, a hard delete that cascades to
  `google_connections`; then sign out.
- **Disconnect:** revoke at `https://oauth2.googleapis.com/revoke`, then delete the row through
  the user's own client. If revocation fails, delete anyway and tell the user (BR-10).

**Why:** Protects against requests forged from other sites (SR-10). Keeping the admin key in one
place limits the damage if it's misused (CLAUDE.md).

**Alternatives:** Route Handlers for disconnect and delete (rejected: GET is open to forged
requests, and POST would need hand-made CSRF tokens); deleting users with a database function
(rejected: needs elevated database rights).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `app/**/actions.ts`, `lib/db/admin.ts`.

**Related decisions:** D-004, D-006

**Supersedes:** None

**Consequences:** Delete account depends on the service-role key being present. It is validated at startup.

**Implementation Guidance:** Every action calls `requireUser()` first and validates input with Zod.

**Validation:** Review that only one file imports the admin client; manual deletion test (AC-11.x).

**Open Questions:** None.

---

### D-014: Localhost Only; Data Stored in Singapore

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Run only on `http://localhost:3000`. The Supabase project is in Singapore
(`ap-southeast-1`), so all stored data is held **outside India**.

**Why:** It's a learning project; deployment is out of scope.

**Alternatives:** Not formally assessed.

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** Deployment, data residency.

**Related decisions:** D-006

**Supersedes:** None

**Consequences:** Cookies cannot use `Secure` on plain HTTP localhost. Any future production use
must assess data residency and cross-border transfer obligations (for example under India's
DPDP Act, 2023) and turn on HTTPS and `Secure` cookies.

**Implementation Guidance:** Set cookie `Secure` when `APP_URL` starts with `https://`.

**Validation:** Not applicable for localhost.

**Open Questions:** Data residency before any production use.

---

### D-015: Test Runner and New Dependencies — Vitest and jose

**Status:** Accepted (approved by Ravi, 2026-10-22)

**Decision:** Install `vitest` as a dev dependency for unit tests, with a `test` script, and
install `jose` as a runtime dependency for ID-token verification (D-009). In Vitest, map the
`server-only` package to an empty module so server modules can be imported in tests.

**Why:** Vitest runs TypeScript and ES modules without extra setup and is fast. `jose` has no
dependencies of its own and verifies JWTs using standard Web Crypto. Hand-written JWT
verification would break testing rule SEC-038.

**Alternatives:** Jest (rejected: needs extra TypeScript and ES-module setup); Node's built-in
`node:test` (considered: no install, but the `@/` path alias and TypeScript need extra work);
`google-auth-library` instead of `jose` (rejected: heavier).

**Date:** 2026-10-22

**Decision owner / approver:** Ravi

**Scope:** `package.json`, `vitest.config.ts`.

**Related decisions:** D-009

**Supersedes:** None

**Consequences:** Two new packages to keep updated and audit.

**Implementation Guidance:** Install only after Ravi approves. Unit tests must not use the network (testing rule LVL-004).

**Validation:** `npm test` runs and passes; `npm audit` reviewed after install.

**Open Questions:** None.

---

## Decision Record Template

Copy this section for each new decision. Replace all placeholders and remove fields
that genuinely do not apply. Do not leave example text presented as a real decision.

### D-XXX: Short, Specific Decision Title

**Status:** Proposed

**Decision:** State exactly what is being chosen. Make this specific enough that someone can
implement it without guessing about the central choice.

**Why:** Explain why this option is preferred, including the most important trade-offs
and constraints.

**Alternatives:** List the realistic alternatives considered and briefly explain why
they were or were not selected. Do not invent alternatives that were not considered.
If no alternatives were assessed, write `Not formally assessed`.

**Date:** YYYY-MM-DD

**Decision owner / approver:** Name or role, if applicable.

**Scope:** Component, service, or area affected.

**Related decisions:** D-XXX, or `None`.

**Supersedes:** D-XXX, or `None`.

**Consequences:** Note expected benefits, trade-offs, drawbacks, and risks where relevant.

**Implementation Guidance:** List constraints or requirements that implementation must respect.

**Validation:** Explain how the decision will be verified, such as through tests, reviews,
security checks, performance targets, or operational checks.

**Open Questions:** List unresolved questions, or write `None`.

---

## Decision-Making Rules

1. **Do not invent approval.** If the user has not approved a consequential choice,
   keep it `Proposed` or ask for clarification when necessary.
2. **Follow accepted decisions.** Before proposing a conflicting change, identify the
   relevant decision ID and explain why a change may be needed.
3. **Handle conflicts explicitly.** If decisions contradict one another, do not silently
   choose one. Explain the conflict and request clarification unless an existing
   documented precedence rule resolves it.
4. **Use reasonable defaults for low-impact gaps.** If a minor implementation detail
   is missing, choose a sensible option consistent with accepted decisions and record
   the assumption where useful.
5. **Escalate material uncertainty.** Ask before making a materially consequential,
   irreversible, security-sensitive, costly, or data-destructive decision when the
   available requirements do not resolve it.
6. **Preserve history.** When changing a decision, add a new record and mark the old
   record `Superseded`, with links between the two.
7. **Keep records factual.** Separate confirmed requirements, approved decisions,
   assumptions, and proposals.
8. **Do not treat this file as a substitute for safeguards.** Follow repository
   permissions, security controls, review requirements, tests, and deployment
   approval rules.

## Optional Decision Categories

Use a category in the title or scope when helpful. Examples:

- Architecture and system boundaries
- Languages, frameworks, and libraries
- APIs and integration contracts
- Database and data modelling
- Authentication and authorization
- Security, privacy, and encryption
- Infrastructure, deployment, and scaling
- Reliability, monitoring, and logging
- Testing and quality standards
- Cost, licensing, and vendor choices

## Change Log

| Date | Change | Related decision |
|---|---|---|
| Not recorded | Initial decision log created with D-001 | D-001 |
| 2026-10-22 | Index corrected to list D-001; D-002 to D-015 proposed | D-001 to D-015 |
| 2026-10-22 | D-002 to D-015 accepted by Ravi; D-001 superseded by D-002 | D-001 to D-015 |
