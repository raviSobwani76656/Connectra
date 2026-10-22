# Connectra — Project Brief

| Attribute | Value |
|---|---|
| Status | **Approved by Ravi, 2026-10-22** |
| Version | 1.4 (Phase 5 security review: AC-12.3 per D-023). 1.3 (Phase 5 consistency: FR-11/AC-11.2 DELETE confirmation, BR-08 configuration errors, BR-14, OAuth cookie row). 1.2 updated FR-07, BR-06, BR-08 and AC-7.x; 1.1 added FR-12, FR-13, BR-12. |
| Date | 2026-10-22 |
| Business owner / approver | Ravi |
| Other owners | TBD |
| Testing standard followed | `docs/STANDARD_IT_TESTING_RULES.md` v1.0 |
| Risk tier | **Tier 2 — High** (see section 7) |

> This brief describes **what** Connectra must do and **why**. It deliberately contains no
> technology choices; those are recorded in `docs/DECISIONS.md`.

---

## 1. Business goal

Connectra is an individual learning project. Its goal is to demonstrate, end to end and
securely, how a web application can:

1. Let people create an account and sign in with an email address and password.
2. Let a signed-in person grant the application limited, revocable access to their Google
   account through Google's own approval page.
3. Show that person their Google name, email and their most recent Google Drive files,
   without the application ever seeing their Google password or file contents.

Understanding the design and its security properties matters more than delivery speed.

## 2. Users

| User | Description |
|---|---|
| Account holder | A person who signs up, signs in, connects one Google account, views their own details and files, disconnects, and may delete their account. |
| Developer / owner | Ravi. Builds, runs and tests the application on a local machine. No administrator role exists in the application. |

There is a single user role. Every account holder may see **only their own** data.

## 3. Requirements

Priority: **P1** is built and verified first; **P2** is built only after P1 is verified.

### 3.1 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A visitor can create an account with an email address and a password. | P1 |
| FR-02 | An account holder can sign in with their email address and password. | P1 |
| FR-03 | A signed-in account holder can sign out. | P1 |
| FR-04 | Only signed-in account holders can reach the dashboard; anyone else is sent to the sign-in page. | P1 |
| FR-05 | A signed-in account holder can connect one Google account by approving access on Google's own page. The application never sees or stores the Google password. | P2 |
| FR-06 | When connected, the dashboard shows the connected Google account's name and email. | P2 |
| FR-07 | When connected, the dashboard shows the account holder's 20 most recently modified Google Drive items, newest first, each with name, type, last-modified date and time, and an "Open in Drive" link. The holder can refresh the list. File contents are never downloaded or stored. | P2 |
| FR-08 | The dashboard shows clear empty states: a "Connect Google Drive" prompt when not connected, and a message when the connected Drive has no files. | P2 |
| FR-09 | The connection persists: after signing out and back in, the account holder sees their Google details and files without reconnecting (subject to limitation L-01). | P2 |
| FR-10 | A signed-in account holder can disconnect Google: access is revoked with Google and the stored connection is deleted. | P2 |
| FR-11 | A signed-in account holder can permanently delete their account and all data stored about them, after re-confirming their password and typing DELETE. | P2 |
| FR-12 | When email confirmation is required by the account service, a new account holder is told to check their email, can confirm their address through the emailed link, and is then signed in or asked to log in. The application works whether confirmation is required or not. | P1 |
| FR-13 | A person waiting for a confirmation email can request a new one, at most once per 60 seconds. | P1 |

### 3.2 Business rules

| ID | Rule |
|---|---|
| BR-01 | Email addresses are compared case-insensitively and must be a valid address format. |
| BR-02 | Passwords must be 12 to 72 characters. No other composition rules are imposed. |
| BR-03 | An account holder can have at most one connected Google account. Connecting again replaces the previous connection. |
| BR-04 | The same Google account may be connected by more than one Connectra account; each connection is independent. |
| BR-05 | The file list contains items the account holder can see in their own Drive or that are shared with them, excluding trashed items and items in shared drives. Folders are included. |
| BR-06 | Item types are shown as a friendly label for common types (for example "Google Sheets", "PDF", "Folder"); otherwise the label "File" is shown. Raw type identifiers are never shown. Labels: Folder, Google Docs, Google Sheets, Google Slides, PDF, Image, Video, Word, Excel, PowerPoint, Text, File. |
| BR-07 | Dates and times are shown in the Asia/Kolkata time zone in the format `22 Oct 2026, 14:05`. |
| BR-08 | If Google reports the stored access permission as invalid, revoked or lacking Drive access, or the stored values cannot be decrypted, the stored connection is removed and the dashboard shows "Your Google Drive connection has expired or was removed. Please reconnect." **once**; later visits show the normal "Connect Google Drive" state (D-021). Temporary Google problems (rate limits, server errors, timeouts) and configuration problems (Drive API not enabled for the project, D-022) keep the connection and show a retryable files error. |
| BR-14 | If the stored connection cannot be read (a database problem), the dashboard shows "Couldn't load your Google Drive connection right now. Please try again." and changes nothing. |
| BR-13 | "Open in Drive" uses only the link returned by Google, and only if it is an https link to drive.google.com or docs.google.com; otherwise no link is shown. It opens in a new tab without giving the new page access to Connectra. |
| BR-09 | If Google does not provide a name, only the email is shown. |
| BR-10 | On disconnect, if Google cannot confirm revocation, the stored connection is still deleted and the account holder is told how to remove access manually in their Google account settings. |
| BR-11 | On account deletion, revocation with Google is attempted first (best effort); deletion of stored data proceeds even if revocation fails. |
| BR-12 | When email confirmation is required, the sign-up result and the resend result are the same whether or not the email already has an account. The only exception is the login message for an unconfirmed account, which appears only after a correct password (D-018). |

### 3.3 Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | All mandatory security and privacy requirements in section 5 pass. | P1/P2 |
| NFR-02 | Error messages shown to users are helpful and never expose internal details, identifiers, stack traces or secrets. | P1 |
| NFR-03 | Accessibility: forms have visible labels, all actions are keyboard-operable, error messages are announced in text, and text meets WCAG 2.2 AA contrast. Checked manually. | P1 |
| NFR-04 | Supported browsers: current Chrome and Edge on Windows. | P1 |
| NFR-05 | Performance (localhost, normal home network): the dashboard with the file list is fully shown within 5 seconds of navigation. Measured manually with browser developer tools. | P2 |
| NFR-06 | Calls to Google time out within 10 seconds and show a retryable error instead of hanging. | P2 |
| NFR-07 | Maintainability: automated lint, type-check, unit tests and build all pass with no skipped or weakened tests. | P1 |
| NFR-08 | Future scale (not built or load-tested now): the design must not block growth to 1 crore (10 million) registered users and 20 lakh (2 million) concurrent users — no per-server session state, no design that requires a single machine. | Future |

### 3.4 Data requirements

| ID | Requirement | Priority |
|---|---|---|
| DATA-01 | Account passwords are stored only in a one-way, salted, slow-hash form by the account service; the application never stores or logs them. | P1 |
| DATA-02 | Each account holder's stored data is owned by that account and is deleted when the account is deleted. | P1 |
| DATA-03 | The long-lived Google access permission (refresh credential), the Google name and the Google email are stored encrypted with authenticated encryption; they are never stored in readable form. | P2 |
| DATA-04 | Short-lived Google access credentials and Drive file lists are never stored; they are obtained fresh when needed and discarded after the request. | P2 |
| DATA-05 | Disconnect deletes all stored Google connection data for that account holder. | P2 |

## 4. Out of scope

| Item | Reason |
|---|---|
| Box and any integration other than Google | Not needed for the learning goal. |
| File contents: download, preview, edit, upload | Only file metadata is needed; avoiding contents minimizes privacy risk. |
| Search, filters, sorting options | Not needed for the learning goal. |
| Deployment beyond localhost | Learning project; no production hosting. |
| Administrator roles or tools | Single user role only. |
| Building or load-testing for full future scale | Recorded as NFR-08 only. |
| Password reset, multi-factor authentication | Not required for this MVP. |

## 5. Mandatory security and privacy requirements (pass/fail)

A single failure blocks acceptance, regardless of other results.

| ID | Requirement | Verification |
|---|---|---|
| SR-01 | An account holder can never see, change or delete another account holder's data or Google files, including by changing identifiers or calling server endpoints directly. | Manual second-user test; access-control unit tests; data-store policy review. |
| SR-02 | Access checks happen on the server for every protected page and action, not only in the user interface. | Code review; direct-request test while signed out. |
| SR-03 | No passwords, Google credentials, Google name or Google email are stored in readable form. | Inspect stored rows; encryption unit tests. |
| SR-04 | Encrypted values cannot be modified or moved between accounts or fields without detection. | Tamper and swap unit tests. |
| SR-05 | Secrets never reach the browser, the code repository or logs. | Build output search; secret scan; code review. |
| SR-06 | Logs never contain tokens, passwords, emails, names, file names or secrets. | Log review during manual tests. |
| SR-07 | The Google approval flow rejects forged, replayed, expired or mismatched responses (state, code verifier, nonce, issuer, audience, signature, expiry). | OAuth unit tests; manual cancelled-approval test. |
| SR-08 | Only the minimum Google permissions are requested: basic profile, email, and read-only file metadata. | Review of the approval request; Google consent screen shows only these. |
| SR-09 | All external input (forms, URL parameters, Google responses) is validated on the server; invalid input is rejected without side effects. | Validation unit tests. |
| SR-10 | State-changing actions (sign out, disconnect, delete account) cannot be triggered by another website. | Code review: no state changes on plain links; origin-checked submissions. |
| SR-11 | Session cookies are not readable by page scripts and are cleared on sign-out. | Browser developer tools inspection. |
| SR-12 | The application fails safely with a clear startup error if a required secret is missing or malformed. | Configuration unit tests. |
| SR-13 | Account deletion removes the account and every stored record about it. | Manual deletion test with stored-row inspection. |

## 6. Data handling

| Data | Why it is needed | Protection | Retention | Deletion |
|---|---|---|---|---|
| Email address (account) | Sign-in identity | Held by the account service; access restricted to the owner | Until account deletion | Deleted with the account (FR-11) |
| Password | Sign-in | One-way salted slow hash by the account service; never logged | Until account deletion | Deleted with the account |
| Session cookie | Keep the user signed in | Not readable by scripts; sent only to this site; expires per account-service defaults | Session lifetime | Cleared on sign-out |
| Google refresh credential | Fetch fresh access to list files without reconnecting (FR-09) | Authenticated encryption, bound to account and field | Until disconnect, invalidation or account deletion | FR-10, BR-08, FR-11 |
| Google name and email | Show on dashboard (FR-06) | Authenticated encryption, bound to account and field | Same as above | Same as above |
| Short-lived Google access credential | Call Google to list files | Kept in memory for one request only | Not retained | Discarded after the request |
| Drive file metadata (name, type, modified time) | Show on dashboard (FR-07) | Fetched per request, never stored | Not retained | Not applicable |
| Temporary approval-flow values (state, code verifier, nonce) | Protect the Google approval flow | One short-lived, script-inaccessible cookie, encrypted and bound to the account (D-020) | 10 minutes maximum | Cleared at the callback, before the code is exchanged |

**Data residency:** stored data is held in a data centre in **Singapore (ap-southeast-1), outside India**.
Any future production use must assess data residency and cross-border transfer obligations
(for example under India's Digital Personal Data Protection Act, 2023) before launch.

## 7. Risk tier and tailoring

**Classification: Tier 2 — High** (Annex 2: the highest tier triggered by any factor applies).

| Factor | Assessment | Tier |
|---|---|---|
| Safety | None | 4 |
| Financial impact | None | 4 |
| Data sensitivity | Personal data (email, name) and Google access credentials | **2** |
| Legal or regulatory exposure | Personal-data law could apply in production; none material for local learning use | 3 |
| User reach | Individual / experimental use | 4 |
| Recoverability | Account deletion is irreversible | 2–3 |
| Autonomy | Informational only | 4 |
| Integration footprint | One external system (Google) | 3 |

### 7.1 Recorded exceptions (infeasible for a solo, local learning project)

Approval: approved by Ravi on 2026-10-22.

| ID | Rule(s) | Exception | Compensating control | Expires |
|---|---|---|---|---|
| EXC-01 | GOV-004, GOV-014 | No separate standard owner or responsibility matrix; Ravi holds all roles. | Roles listed in this brief. | On any team or production use |
| EXC-02 | PRIN-004, DES-015, STAT-001 | No independent reviewer; the author (AI assistant) and Ravi review. | Ravi reviews every plan and diff; automated security review run. | Same |
| EXC-03 | STAT-003, SEC-056, LVL-013, SEC-049 (CI part) | No CI pipeline; checks run locally. | Lint, type-check, tests, build and dependency audit run locally before each checkpoint. | Same |
| EXC-04 | SEC-057, SEC-059 | No dynamic scan or penetration test. | Manual security checklist and automated code security review. | Same |
| EXC-05 | REQ-015 | Traceability is requirement → test only, not tool-generated bidirectional. | Traceability table in section 12. | Same |
| EXC-06 | COMPL-002, PRIV-010 | No legal or privacy review. | Data minimized; residency noted in section 6. | Before any production use |
| EXC-07 | SEC-009 | Brute-force protection relies on the account service's built-in limits; not separately tested. | Limitation L-04. | Same |

## 8. Acceptance criteria

Format: **Given / When / Then**. "AC-x.y" IDs are referenced in the traceability table.

### FR-01 Sign up
- **AC-1.1 (success)** Given a visitor on the sign-up page, when they enter a valid new email and a 12–72 character password, then an account is created, they are signed in, and they land on the dashboard.
- **AC-1.2 (failure)** Given an invalid email, a password shorter than 12 or longer than 72 characters, or empty fields, when they submit, then no account is created and a specific, safe error is shown next to the field.
- **AC-1.3 (failure)** Given an email that already has an account, when they submit, then no second account is created and an error is shown (see L-02).

### FR-02 Log in
- **AC-2.1 (success)** Given an existing account, when the correct email and password are entered, then the holder lands on the dashboard.
- **AC-2.2 (failure)** Given a wrong password or unknown email, when they submit, then they stay signed out and see the same generic "Invalid email or password" message in both cases.

### FR-03 Log out
- **AC-3.1 (success)** Given a signed-in holder, when they sign out, then the session cookie is cleared and they land on the sign-in page.
- **AC-3.2 (permission)** Given a holder who has signed out, when they press Back or open the dashboard address, then they are sent to the sign-in page.

### FR-04 Protected dashboard
- **AC-4.1 (success)** Given a signed-in holder, when they open the dashboard, then it is shown.
- **AC-4.2 (permission)** Given a signed-out visitor, when they open the dashboard address directly, then they are sent to the sign-in page and no dashboard data is sent to the browser.
- **AC-4.3 (permission)** Given a signed-in holder, when they open the sign-in or sign-up page, then they are sent to the dashboard.

### FR-12 Email confirmation
- **AC-12.1 (alternative: confirmation required)** Given confirmation is required, when a visitor signs up with a valid new email and password, then no error is shown and a "Check your email" screen says: "We've sent a confirmation link to your email address. Click it to activate your account, then log in." with a link back to log in.
- **AC-12.2 (permission: no enumeration)** Given confirmation is required, when a visitor signs up with an email that already has an account, then the same "Check your email" screen is shown.
- **AC-12.3 (success)** Given a valid, unused confirmation link, when it is opened, then the address is confirmed, the browser is **not** left signed in, and the person lands on the log-in page with "Your email is confirmed. You can now log in." (D-023: prevents a confirmation link from someone else signing this browser into their account).
- **AC-12.4 (failure)** Given an expired, already-used or malformed link, when it is opened, then a clear message explains the link is invalid or expired and offers to resend; nothing else changes.
- **AC-12.5 (failure)** Given an unconfirmed account, when the correct password is entered on log in, then "Please confirm your email address first. Check your inbox for the confirmation link." is shown with a resend option; with a wrong password the generic "Invalid email or password." is shown.
- **AC-12.6 (alternative: confirmation not required)** Given confirmation is not required, then sign-up behaves as AC-1.1 and AC-1.3.

### FR-13 Resend confirmation
- **AC-13.1 (success)** Given the "Check your email" screen, the unconfirmed-login message or the invalid-link page, when "Resend confirmation email" is chosen, then "If an account needs confirming, we've sent a new link." is shown and the option is disabled for 60 seconds.
- **AC-13.2 (permission: no enumeration)** Given an email with no account, or one already confirmed, when a resend is requested, then the same message is shown.
- **AC-13.3 (failure)** Given the account service's email limit is reached, when a resend is requested, then a friendly "please wait" message is shown.

### FR-05 Connect Google
- **AC-5.1 (success)** Given a signed-in, not-connected holder, when they choose "Connect Google Drive" and approve on Google's page, then they return to the dashboard in the connected state.
- **AC-5.2 (failure)** Given the holder cancels on Google's page, when Google returns, then they see "Google connection was cancelled" and remain not connected.
- **AC-5.3 (failure)** Given a returned response with a missing or mismatched state, nonce or code verifier, or an invalid identity token, when it is processed, then nothing is stored and a generic connection error is shown.
- **AC-5.4 (permission)** Given a signed-out visitor, when they open the connect or return address directly, then they are sent to the sign-in page and nothing is stored.
- **AC-5.5 (failure)** Given Google returns no long-lived permission, when it is processed, then nothing is stored and the holder is asked to try again.

### FR-06 Show Google name and email
- **AC-6.1 (success)** Given a connected holder, when they open the dashboard, then the connected Google name and email are shown.
- **AC-6.2 (alternative)** Given Google supplied no name, then only the email is shown.
- **AC-6.3 (permission)** Given two holders A and B each connected, when A views the dashboard, then only A's Google details are shown.

### FR-07 Show recent Drive files
- **AC-7.1 (success)** Given a connected holder with more than 20 items, when the dashboard loads, then exactly 20 items are shown, newest modified first, each with name, friendly type and date/time per BR-07.
- **AC-7.2 (alternative)** Given fewer than 20 items, then all are shown.
- **AC-7.3 (failure)** Given Google is unreachable or times out, then the Google details still show and the file area shows a retryable error.
- **AC-7.4 (failure)** Given Google reports the permission revoked, then the stored connection is removed and the expired-or-removed message with "Reconnect Google Drive" is shown once; the next visit shows "Connect Google Drive" (BR-08).
- **AC-7.6 (success)** Given a connected holder, when they choose "Open in Drive" on a file, then the file's Google Drive page opens in a new tab (BR-13).
- **AC-7.7 (success)** Given a connected holder, when they choose "Refresh", then the list is reloaded from Google.
- **AC-7.5 (permission)** Given two connected holders, when A views the dashboard, then none of B's files are shown.

### FR-08 Empty states
- **AC-8.1** Given a not-connected holder, then the dashboard shows a "Connect Google Drive" prompt and no file area.
- **AC-8.2** Given a connected holder with no items, then the file area shows "No files found in your Google Drive."

### FR-09 Persistence
- **AC-9.1** Given a connected holder, when they sign out and sign in again, then their Google details and files show without reconnecting.

### FR-10 Disconnect
- **AC-10.1 (success)** Given a connected holder, when they choose Disconnect and confirm, then access is revoked with Google, the stored connection is deleted, and the "Connect Google Drive" state is shown.
- **AC-10.2 (failure)** Given revocation with Google fails, then the stored connection is still deleted and the holder is told how to remove access manually (BR-10).
- **AC-10.3 (permission)** Given a signed-out visitor or another website, when it attempts to trigger disconnect, then nothing changes.

### FR-11 Delete account
- **AC-11.1 (success)** Given a signed-in holder, when they confirm deletion and re-enter the correct password, then revocation with Google is attempted, the account and all stored data are deleted, they are signed out, and they can no longer sign in.
- **AC-11.2 (failure)** Given a wrong password, or a confirmation other than exactly DELETE, then nothing is deleted and an error is shown.
- **AC-11.3 (permission)** Given holder A, when A deletes their account, then holder B's account and data are unaffected.
- **AC-11.4 (alternative)** Given a deleted account's email, when someone signs up with it again, then a fresh, empty account is created.

## 9. Constraints

- Runs only on localhost (`http://localhost:3000`) on Windows.
- The Google approval page is in testing mode with an approved test-user list.
- The approved Google permissions are limited to basic profile, email and read-only file metadata.
- Individual learning project with one developer; no CI pipeline.

## 10. Assumptions

| ID | Assumption |
|---|---|
| A-01 | Only accounts on the Google test-user list can connect while the Google app is in testing mode. |
| A-02 | Email ownership is not verified on sign-up during development (see L-02). |
| A-03 | The account service's default session lifetime and attempt-rate limits are acceptable for development. |
| A-04 | Ravi fills in and protects the local secrets file; it is never committed. |

## 11. Risks and known limitations

| ID | Risk / limitation | Impact | Mitigation / acceptance |
|---|---|---|---|
| L-01 | While Google's approval page is in testing mode, Google expires the long-lived permission after about 7 days, so FR-09 holds for up to 7 days only. | Holder must reconnect weekly. | Handled gracefully by BR-08. Accepted for localhost. The 7-day figure comes from Google's consent-screen guidance and was not re-checked on 2026-10-22. |
| L-02 | When email confirmation is **not** required, sign-up reveals whether an email already has an account (account enumeration), and anyone can register any email address. With confirmation required, sign-up and resend do not reveal this (BR-12). | Low for local use. | Accepted for development only; must be revisited before any production use. |
| L-07 | Some email security scanners (for example Microsoft Defender Safe Links in Outlook) open links in incoming email before the person does, which uses up the one-time confirmation link. | The person sees "link expired" and must resend. | Accepted; resend is offered on the error page (D-017). |
| L-08 | The account service's built-in email sender allows only about 2 emails per hour per project. | Testing with confirmation required is slow. | Accepted for development; a custom email provider would raise the limit. |
| L-03 | Production use of read-only file metadata permission would require Google app verification and a security assessment. | Blocks production launch. | Out of scope; recorded. |
| L-04 | No application-level rate limiting beyond the account service's built-in limits. | Brute-force risk in production. | Accepted for localhost. |
| L-05 | An account holder can technically read or overwrite their own encrypted stored values through the data service using their own session. | They gain only unreadable ciphertext; tampering is detected and treated as "not connected". No cross-account access. | Accepted; recorded as a decision. |
| L-06 | Data is stored outside India (Singapore). | Residency obligations for production. | Assess before any production use. |
| R-01 | Loss or leak of the encryption key. | Stored Google data unreadable or exposed. | Key kept only in the local secrets file; key-version field allows rotation. |
| R-02 | Changes in Google's approval or Drive interfaces. | Connection or listing breaks. | All Google responses validated; errors shown safely. |

## 12. Open questions

| ID | Question | Owner |
|---|---|---|
| Q-01 | None at present. | — |

## 13. Traceability

Verification method: **U** = automated unit test, **M** = manual test checklist item, **R** = review/inspection.
Specific test and checklist IDs are added during build phases.

| Requirement | Acceptance criteria | Security reqs | Verification |
|---|---|---|---|
| FR-01 | AC-1.1, 1.2, 1.3 | SR-09 | U (validation), M |
| FR-02 | AC-2.1, 2.2 | SR-09 | U (validation), M |
| FR-03 | AC-3.1, 3.2 | SR-10, SR-11 | M, R |
| FR-04 | AC-4.1, 4.2, 4.3 | SR-01, SR-02 | U (access rules), M |
| FR-05 | AC-5.1–5.5 | SR-07, SR-08, SR-09 | U (state, nonce, verifier, token checks), M |
| FR-06 | AC-6.1–6.3 | SR-01, SR-03 | U (decryption), M |
| FR-07 | AC-7.1–7.7 | SR-01, SR-09, SR-06 | U (response validation, type labels, date format), M |
| FR-08 | AC-8.1, 8.2 | — | M |
| FR-09 | AC-9.1 | SR-03 | M |
| FR-10 | AC-10.1–10.3 | SR-10, SR-13 | U, M |
| FR-11 | AC-11.1–11.4 | SR-10, SR-13 | M, R |
| FR-12 | AC-12.1–12.6 | SR-09 | U (sign-up result, link parameter validation, unconfirmed-login mapping), M |
| FR-13 | AC-13.1–13.3 | SR-09 | U (uniform response, cooldown), M |
| NFR-01 | Section 5 | SR-01–SR-13 | U, M, R, security review |
| NFR-02 | — | — | U, M |
| NFR-03 | — | — | M |
| NFR-04 | — | — | M |
| NFR-05 | — | — | M |
| NFR-06 | AC-7.3 | — | U |
| NFR-07 | — | — | Local check run |
| NFR-08 | — | — | R (design review only) |
| DATA-01 | — | SR-03 | R |
| DATA-02 | AC-11.1, 11.3 | SR-13 | M, R |
| DATA-03 | AC-6.1 | SR-03, SR-04 | U, R |
| DATA-04 | — | SR-03 | R |
| DATA-05 | AC-10.1 | SR-13 | M |
