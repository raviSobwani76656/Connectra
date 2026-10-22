---
name: api-and-data
description: Use when creating or changing APIs, interface contracts, database schemas, migrations, queries, caching, background jobs, or any data flow or storage behavior.
---

# API and Data Engineering

## Purpose
- Design stable interfaces and dependable data flows.
- Protect data integrity, compatibility, and correctness.
- Stay technology-agnostic: follow the repo's existing API, persistence, and data-access conventions.

## 1. Interface Contracts
Before implementing or changing an interface, define:
- Purpose and intended consumers
- Inputs and outputs
- Validation and business rules
- Authentication and authorization requirements
- Error behavior
- Compatibility expectations
- Pagination, filtering, sorting, and limits
Use a formal contract or schema for machine-consumed APIs where supported, and keep the implementation consistent with it.

## 2. Compatibility and Versioning
- Identify existing consumers before changing a public interface.
- Prefer additive, backward-compatible changes.
- Treat removing fields, changing meanings, tightening validation, or changing defaults as breaking.
- Provide a deprecation and migration path for breaking changes.
- Assume old and new versions run side by side during deployments.
- Never silently reinterpret existing data or fields.

## 3. Validation and Errors
- Validate untrusted input at system boundaries.
- Separate format validation from business-rule validation.
- Reject invalid or unauthorized operations before any side effects.
- Return consistent, actionable errors; never expose secrets, stack traces, or internals.
- Never return success when the operation did not complete.
- Do not expose internal persistence models directly as public contracts.

## 4. Idempotency and Side Effects
- Determine whether each operation can be safely repeated.
- Take special care with payments, resource creation, notifications, third-party calls, background jobs, and operations retried after timeouts.
- Use idempotency keys, unique constraints, deduplication, or operation IDs where duplicates cause harm.
- Never assume a timeout means the remote operation failed.

## 5. Data Modeling and Integrity
- Define entity ownership and relationships.
- Enforce invariants at the authoritative boundary using constraints (uniqueness, required values, relationships).
- Use transactions for changes that must succeed or fail together; keep them short.
- Handle concurrent writes and conflicting updates.
- Define deletion, retention, archival, and audit behavior.
- Use soft deletion only when its query and lifecycle implications are understood.
- Preserve tenant and customer isolation.

## 6. Schema Changes and Migrations
- Treat migrations as production changes: explicit, ordered, reviewable.
- Review existing schema and migration history first.
- Account for existing records, data volume, locks, and execution time.
- Preserve data unless deletion is explicitly intended.
- Use expand-and-contract so old and new code can run simultaneously.
- Plan recovery or forward-fix for failed migrations.
- Do not assume a migration can be reversed after new writes occur; document manual recovery steps.

## 7. Query and Storage Discipline
- Fetch only the data required; avoid N+1 and repeated queries.
- Index based on real query patterns and measured performance, not every field.
- Paginate or bound all potentially large result sets.
- Avoid unbounded memory use with large datasets.
- Watch transaction duration, connection usage, and contention.
- Measure before invasive optimization.

## 8. Caching
Before adding a cache, define:
- What is safe to cache and how fresh it must be
- Expiry and invalidation rules
- Whether stale data can cause wrong decisions
- Key isolation (tenant, user, permission, locale)
- Behavior when the cache is unavailable
Never use a cache as the sole authority for permissions or security decisions.

## 9. Asynchronous Processing
For jobs, queues, and events, define:
- Ownership of execution
- Duplicate-delivery handling
- Retry, timeout, and failure policies
- Ordering requirements
- How permanent failures surface
- Status tracking and partial-completion handling
- Acknowledgment and recovery
Never assume a queue guarantees exactly-once business execution.

## 10. Data Lifecycle and Privacy
- Collect only necessary data.
- Apply retention, archival, deletion, and export rules.
- Protect sensitive fields in storage, logs, caches, and interfaces.
- Ensure deletion covers related and derived data where required.

## 11. Completion Checklist
- [ ] Contracts and compatibility considered
- [ ] Validation and error behavior consistent
- [ ] Duplicate operations and side effects handled
- [ ] Invariants and relationships protected
- [ ] Concurrent updates considered
- [ ] Migrations preserve data and suit deployment conditions
- [ ] Queries and indexes fit access patterns
- [ ] Cache consistency and isolation understood
- [ ] Background jobs have failure and retry behavior
- [ ] Retention and privacy addressed
- [ ] Tests and documentation updated

## Decision Rule
Data correctness comes first. Never trade integrity, compatibility, isolation, or recoverability for performance or convenience.
