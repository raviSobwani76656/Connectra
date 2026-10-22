# Connectra

A learning project: sign up and log in with email and password, connect a Google account, and
see your Google name, email and recent Google Drive files on a dashboard.

> **Work in progress.** P1 (accounts, log in, log out, protected dashboard, email confirmation)
> is built. Google Drive (P2) is not built yet. A full README (setup, architecture, known
> limitations) follows in Phase 5. See `docs/PROJECT_BRIEF.md` and `docs/DECISIONS.md`.

## Run locally (Windows, PowerShell)

```powershell
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests
npm run lint
npx tsc --noEmit
npm run build
```

`.env.local` must contain every variable listed in `.env.example`. The server refuses to start,
naming the variable (never its value), if one is missing or malformed.

## Email confirmation: testing both modes

The app works whether Supabase's **Confirm email** setting is on or off (D-017). Switch it in the
Supabase dashboard under **Authentication → Sign In / Providers → Email → Confirm email**.

**One-time setup for "on" mode** (Supabase dashboard):
1. **Authentication → URL Configuration → Site URL:** `http://localhost:3000`
2. **Authentication → Emails → Templates → Confirm signup:** make the link
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   (do not add a `next` parameter; the app ignores it).

| | Confirm email **off** | Confirm email **on** |
|---|---|---|
| Sign up | Signed in straight away and sent to `/dashboard` | "Check your email" screen; no session until the link is clicked |
| Existing email at sign-up | "An account with this email already exists" (limitation L-02) | The same "Check your email" screen (no enumeration) |
| Confirmation link | Not used | `/auth/confirm` verifies it, then sends you to `/dashboard` (or `/login` with a "confirmed" notice) |
| Log in before confirming | Not applicable | "Please confirm your email address first", with a resend option |

**Limits to know when testing "on" mode:**
- Supabase's built-in email sender allows only about **2 emails per hour per project**
  (limitation L-08). Plan tests around it, or configure custom SMTP.
- The same user can only be emailed once every **60 seconds**. The resend button is disabled
  for 60 seconds after each use.
- Email security scanners (for example Outlook Safe Links) may open the link before you do,
  which uses it up (limitation L-07). Use **Resend** on the error page.
- **Stuck unconfirmed test user?** Resend once the hourly limit has reset, or delete the user in
  **Authentication → Users** and sign up again.
