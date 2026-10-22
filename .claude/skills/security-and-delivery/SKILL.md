---
name: security-and-delivery
description: Use when handling authentication, authorization, user or sensitive data, secrets, dependencies, CI/CD pipelines, deployment, infrastructure, or release and rollback planning.
---

# Security and Delivery

## Purpose
- Protect data, users, systems, and the release process.
- Stay technology-agnostic: inspect existing security controls, dependency management, pipeline, and infrastructure before recommending changes.

## 1. Threat Modeling
Before security-sensitive changes:
- Identify valuable data, critical operations, trust boundaries, and entry points.
- Consider misuse and abuse cases for each interface.
- Weigh impact and likelihood; apply proportionate controls.
- Reassess when architecture, permissions, or data flows change.
No obvious vulnerability is not proof of security.

## 2. Authentication and Authorization
- Authentication = identity; authorization = what that identity may do.
- Check authorization on every protected operation, per resource and action.
- Deny by default; apply least privilege.
- Enforce on the server, never only in the UI.
- Prevent access to other users' or tenants' data via changed IDs or parameters.
- Revalidate when permissions or ownership can change.
- Extra protection for admin and privileged operations.
- Test both allowed and denied access, including cross-user and cross-tenant cases.

## 3. Input Handling and Common Vulnerabilities
Treat all external input as untrusted. Consider:
- Injection (queries, commands, interpreters)
- XSS, CSRF, SSRF
- Insecure deserialization
- Path traversal and unsafe file handling
- Open redirects and unsafe template rendering
- Resource exhaustion / denial of service
- Broken object-level authorization
Use parameterized operations, safe APIs, context-aware encoding, and bounded resources, not string filtering alone.

## 4. Secrets and Credentials
- Never commit credentials, keys, tokens, or production secrets.
- Use the environment's secret-management mechanism.
- Keep secrets out of logs, errors, artifacts, and client-side config.
- Separate credentials per environment and workload.
- Rotate on suspected or confirmed exposure.
- If a secret is found, never repeat it; follow containment and rotation.

## 5. Data Protection and Privacy
- Identify sensitive and regulated data; collect only what's needed.
- Restrict access by business need.
- Encrypt in transit and at rest as appropriate.
- Apply retention and deletion policies; protect backups, exports, and temp files.
- Consider data residency and regulatory requirements.
- Never send sensitive data to external services without authorization and purpose.

## 6. Dependencies and Supply Chain
- Use trusted sources, version constraints, and lockfiles.
- Scan for vulnerabilities and review advisories.
- Evaluate new dependencies for necessity, maintenance, and risk.
- Remove unused dependencies; don't add packages for trivial code.
- Review changes to build scripts, plugins, and package sources.
- Protect integrity of build inputs and release artifacts.

## 7. Secure Development and CI
- Keep credentials out of code and build logs.
- Grant automated workflows minimal permissions.
- Restrict deployment credentials to the jobs that need them.
- Require review and approval for protected branches and production.
- Run tests and security checks in the pipeline; failures block merges.
- Never run untrusted code with privileged access.
- Review infrastructure, permission, and pipeline changes carefully.

## 8. Safe Deployment and Release
- Separate build and deploy stages; promote one verified artifact across environments.
- Use reproducible builds and controlled artifact storage.
- Validate configuration before deployment.
- Ensure app versions and data schemas stay compatible during rollout.
- Use staged rollouts, canaries, or feature flags where beneficial.
- Define health/success criteria and monitor after release.
- Document rollback or forward-recovery procedures.
Choose a deployment strategy that fits real availability needs; not every system needs zero downtime.

## 9. Rollback and Irreversible Changes
Before deploying, check whether rollback is safe. Watch for:
- Destructive schema or data changes
- External side effects
- Changes that break older app versions
- Feature flags affecting data creation
- Permission or encryption key changes
Reverting code does not revert database changes or side effects. Where rollback is unsafe, define a forward-fix plan.

## 10. Infrastructure and Access
- Follow the project's infrastructure-management approach; keep changes reviewable and reproducible.
- Least privilege for service identities and automation.
- Separate dev, test, and production access.
- Don't expose admin interfaces unnecessarily.
- Protect infrastructure state and deployment credentials.
- No infrastructure changes unrelated to the task.

## 11. Incident Readiness
- Define backup and recovery expectations; restrict backup access; test restores.
- Document incident escalation and credential revocation.
- Define containment and recovery steps.
- Identify who must be notified when policy or law requires.

## 12. Verification Checklist
- [ ] Authentication and resource-level authorization correct
- [ ] Untrusted input handled safely
- [ ] Secrets and sensitive data protected
- [ ] Common vulnerability classes considered
- [ ] Dependency and supply-chain risks reviewed
- [ ] Pipeline and deployment permissions restricted
- [ ] Config and infrastructure changes reviewable
- [ ] Release compatibility and rollback limits understood
- [ ] Critical data recoverable
- [ ] Security checks performed
- [ ] Remaining risks disclosed

## Decision Rule
Match security controls to the actual threat model. Prefer enforceable protections at authoritative boundaries over assumptions, UI-only restrictions, or undocumented practices.
