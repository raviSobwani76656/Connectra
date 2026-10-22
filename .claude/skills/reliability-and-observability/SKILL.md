---
name: reliability-and-observability
description: Use when calling external services, handling load or failures, adding background workers, health checks, logging, metrics, alerting, performance work, or backup and recovery.
---

# Reliability and Observability

## Purpose
- Build systems that fail predictably, are diagnosable, and recover appropriately.
- Stay technology-agnostic: use mechanisms supported by the app's runtime and platform.

## 1. Define Reliability Requirements
Understand before adding mechanisms:
- Impact of downtime and which operations are business-critical
- Traffic patterns, acceptable latency and error rates
- Dependencies and their failure modes
- Data durability needs, RTO and RPO where defined
Do not invent SLOs; propose measurable targets when missing and the decision matters.

## 2. Timeouts and Resource Limits
- Every blocking or network operation has a timeout suited to its purpose.
- Bound request sizes, concurrency, queues, and resource use.
- Never wait indefinitely on external dependencies.
- Propagate cancellation where safe; respect total time budgets across nested calls.
- Clean up resources on success, failure, or cancellation.

## 3. Retries and Backoff
- Retry only when safe and likely to help (transient failures only).
- Bounded retries with backoff and jitter; respect retry-after hints and deadlines.
- Avoid retry multiplication across layers.
- Confirm idempotency before retrying side effects.
- Exhausted retries must produce an observable failure or defined recovery path.

## 4. Failure Isolation and Degradation
Use where justified by the failure mode:
- Circuit breakers
- Concurrency limits and bulkheads
- Queue limits and backpressure
- Graceful degradation and fallbacks
- Load shedding
Fallbacks must preserve correctness and security; stale or default data is not always safe.

## 5. Background Jobs and Queues
Define:
- Delivery and acknowledgment behavior
- Retry limits and duplicate protection
- Queue capacity and overload behavior
- Ordering requirements
- Poison-message and permanent-failure handling
- Visibility into queue age and delays
- Recovery after worker crash and shutdown of in-flight work

## 6. Health and Lifecycle
- **Liveness:** is the process healthy enough to keep running? Don't fail it just because a dependency is temporarily down.
- **Readiness:** can this instance safely accept work now?
- Handle startup failures, graceful shutdown, in-flight requests, worker termination, and connection cleanup.
- Health endpoints expose only appropriate information.

## 7. Structured Logging
Include: event name, severity, timestamp, request/correlation/trace ID, component, outcome, error class, duration for key operations.
- Log meaningful state changes and failures, not everything.
- Never log passwords, tokens, keys, or unnecessary sensitive data; redact confidential values.
- Avoid high-volume logging that adds cost or buries signals.

## 8. Metrics and Tracing
Monitor where applicable:
- Request/job volume and error rates
- Latency distributions (p50, p95, p99)
- Resource utilization and saturation
- Dependency latency and failures
- Queue depth and message age
- Retry counts and exhausted retries
- Health of critical business workflows
- Use distributed tracing across meaningful service boundaries.
- Avoid high-cardinality labels and sensitive data in telemetry.

## 9. Alerting
- Alert on actionable symptoms and real risks only.
- Set severity and escalation by impact.
- Link alerts to runbooks or investigation steps.
- Include enough context to tell widespread failure from isolated issues.
- Fix root causes of recurring incidents.

## 10. Performance and Capacity
- Set performance expectations for critical operations.
- Measure representative workloads before optimizing.
- Load-test when capacity or latency matters; consider bursts and slow dependencies.
- Verify optimizations preserve correctness and security.
- Never claim scalability from local development performance alone.

## 11. Backup and Recovery
- Determine what must be recoverable; set backup frequency and retention accordingly.
- Protect backups from unauthorized access and deletion.
- Document and periodically test restoration.
- Include configuration, encryption keys, and dependencies needed to restore service.
A successful backup job does not prove recovery works.

## 12. Completion Checklist
- [ ] Timeouts and resource limits in place
- [ ] Retries bounded and safe
- [ ] Failure isolation proportionate to risk
- [ ] Background work has failure and recovery behavior
- [ ] Liveness and readiness checks are distinct
- [ ] Logs and telemetry give diagnostic context
- [ ] Sensitive data excluded from telemetry
- [ ] Alerts have actionable responses
- [ ] Performance and capacity considered
- [ ] Recovery procedures exist for critical data

## Decision Rule
Reliability means controlled failure, not pretending failure won't happen. Prefer explicit limits, observable behavior, and tested recovery over unbounded retries or silent fallbacks.
