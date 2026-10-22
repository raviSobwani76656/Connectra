---
name: testing-and-quality
description: Use for any code change, bug fix, or feature — to decide what tests to write, how to verify the change, code quality standards, and when work is actually done.
---

# Testing and Quality

## Purpose
- Produce changes that are correct, maintainable, reviewable, and honestly verified.
- Use the repo's existing tooling; do not assume a specific framework, linter, or build system.

## 1. Understand Existing Standards
- Read project instructions and documentation.
- Identify test suites, validation commands, and build process.
- Follow existing naming, formatting, and error-handling conventions.
- Locate tests covering affected behavior and determine regression scope.
- Check for pre-existing failing tests where practical.
- Do not introduce competing tooling without clear need.

## 2. Choose the Right Tests
Combine as appropriate to risk:
- Unit tests for isolated logic and business rules
- Integration tests for component interactions
- Contract tests for important interfaces
- End-to-end tests for critical workflows
- Performance/load tests for capacity requirements
- Security tests for relevant threats

## 3. Testing New Features
- Primary success path
- Important invalid inputs
- Authorization and access restrictions
- Boundary conditions
- Failure and recovery behavior
- Duplicate submissions and concurrency where relevant
- Compatibility with existing behavior
Test externally meaningful behavior, not implementation line by line.

## 4. Fixing Bugs
1. Reproduce the bug or reliably explain its cause.
2. Identify the violated assumption or rule.
3. Add a failing regression test where feasible.
4. Make the smallest complete fix.
5. Run the focused test, then broader checks.
If a test cannot be written, explain why and use the strongest alternative verification.

## 5. Test Integrity
- Never delete, skip, weaken, or rewrite a meaningful test just to pass.
- Never mock the behavior under test; mock only at boundaries.
- Keep test data isolated and deterministic.
- No dependence on execution order or shared mutable state.
- Do not hide failures by suppressing errors or loosening assertions.
- Treat flaky tests as bugs to investigate.

## 6. Code Quality
- Readable, well-named, clear responsibilities.
- Explicit about important assumptions.
- Consistent with project conventions.
- Small enough to review; no unnecessary duplication or abstraction.
- Defensive at real trust boundaries.
- No unrelated formatting, renaming, or refactoring in the same change.

## 7. Error Handling
- Handle errors where they can be interpreted or recovered.
- Preserve context when propagating failures.
- Never swallow exceptions or report false success.
- Avoid broad catches unless they are handled safely.
- User-facing messages are useful without exposing internals.
- Ensure cleanup and resource release happen.

## 8. Documentation
Update docs when changing: public interfaces, setup or configuration, operational procedures, architecture decisions, migrations/recovery steps, or developer workflows. Do not duplicate what the code already makes clear.

## 9. Verification Workflow
1. Review the complete change.
2. Run focused tests, then integration/regression tests.
3. Run formatting, linting, type checks, static analysis, and build.
4. Distinguish new failures from pre-existing ones.
5. Confirm tests actually exercised the intended behavior.
6. Review the final diff for debug code, stray artifacts, and secrets.
Use the project's real commands. Never invent successful results.

## 10. Definition of Done
- [ ] Requirements and acceptance criteria met
- [ ] Success and failure scenarios covered
- [ ] Regression protection in place
- [ ] Project conventions followed
- [ ] Quality checks pass, or failures clearly disclosed
- [ ] No known critical defect concealed
- [ ] Documentation updated
- [ ] Final diff reviewed
- [ ] Limitations and unverified behavior reported honestly
Passing tests and coverage percentages alone do not prove correctness.

## 11. Reviewing AI-Generated Changes
Check specifically for:
- Assumed APIs or libraries that don't exist
- Missing authorization checks
- Wrong edge-case handling
- Unsafe retries or duplicate side effects
- Weak or misleading tests
- Unnecessary abstractions
- Changes outside the requested scope
- Hard-coded configuration or secrets
- Unverified claims about behavior

## Decision Rule
Prefer a small, complete, testable change over a large speculative rewrite. Report exactly what changed, what was verified, and what remains uncertain.
