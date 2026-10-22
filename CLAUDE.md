@AGENTS.md

# Project Instructions

See also: @docs/DECISIONS.md
Read when relevant:
- docs/STANDARD_IT_TESTING_RULES.md — for any testing work
- docs/Architecture_Decision_Framework.md — for architecture decisions

## Project scope
Connectra is a Next.js app where users:
- Sign up and log in with email + password.
- Connect their Google account via OAuth (scopes: `openid email profile` only; no refresh token is stored).
- See their Google name and email on a dashboard.

Constraints:
- Data is encrypted with AES-256-GCM.
- Users never see each other's data.

Out of scope: Google Drive file access, data extraction, search.

## Always
- Inspect the existing code and follow its conventions before writing new code.
- Keep changes small, focused, and within the requested scope.
- Never hard-code secrets, credentials, or environment-specific values.
- Validate all external input; enforce authorization on the server.
- Never delete, skip, or weaken tests to make them pass.
- Before reporting work as done, run the project's format, lint, type-check, test, and build commands.
- Report honestly what was changed, what was verified, and what remains uncertain.

## Project-specific rules
- I am learning: explain the plan (files, purpose, reasons) and wait for my approval before changing code.
- Ask before installing any package. Do not run git commit or git push unless I ask.
- Secrets (SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_SECRET, ENCRYPTION_KEY) are server-only: never NEXT_PUBLIC_, never in "use client" files. Modules using them start with import "server-only".
- Never log tokens, passwords, emails, names or secrets. Never print .env.local values.
- The Supabase admin (secret key) client is used ONLY for account deletion.
- OAuth: always state + PKCE; verify the ID token (signature, iss, aud, exp).
- Encryption: AES-256-GCM with a fresh random 12-byte IV for every encryption.
- For Next.js 16 APIs, check node_modules/next/dist/docs/ rather than memory.
- Record significant decisions in docs/DECISIONS.md as Proposed; never mark your own proposals Accepted.

## Skills
Load the relevant skill for deeper guidance:
- architecture-and-design — structure, boundaries, new modules or services
- api-and-data — APIs, schemas, migrations, queries, caching, jobs
- testing-and-quality — tests, verification, definition of done
- reliability-and-observability — timeouts, retries, logging, metrics, recovery
- security-and-delivery — auth, secrets, dependencies, CI/CD, deployment

## Project Commands
- Install: `npm install`
- Run: `npm run dev` (http://localhost:3000)
- Test: none yet (no test runner or `test` script configured)
- Lint / format: `npm run lint` (ESLint; no formatter configured)
- Type-check: `npx tsc --noEmit`
- Build: `npm run build`
