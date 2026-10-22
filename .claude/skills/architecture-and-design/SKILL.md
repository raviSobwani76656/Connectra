---
name: architecture-and-design
description: Use when starting a project, adding a feature or module, restructuring code, introducing a new service or abstraction, or making any decision about how components are organized and interact.
---

# Architecture and Design

## Purpose
- Build software that is understandable, maintainable, secure by design, and scales with actual requirements.
- Stay technology-agnostic: inspect the repository and follow its established conventions unless there is a concrete reason to change them.

## 1. Understand Before Designing
- Inspect repository structure, entry points, modules, dependencies, configuration, and dev instructions.
- Identify the current architectural style and follow it.
- Find similar features and reuse their patterns.
- Understand business requirements, constraints, expected scale, and compatibility needs.
- Identify tests and boundaries the change could affect.
- Never assume infrastructure, libraries, or services exist without verifying.
- For substantial changes, summarize the proposed approach before implementing.

## 2. Establish Clear Boundaries
- Separate business rules from UI, delivery mechanisms, infrastructure, and persistence.
- Give each module one clear responsibility; keep related behavior together.
- Define explicit interfaces between independently changing components.
- No circular dependencies; no reaching into another module's internals.
- Create shared modules only for genuinely shared responsibilities.
- Avoid both excessive duplication and premature abstraction.
- Do not add a module, service, layer, or abstraction without a meaningful benefit.
- A modular monolith is the default; do not introduce distributed services just to appear scalable.

## 3. Manage Dependencies
- Prefer explicit dependencies over hidden global state.
- Depend on stable abstractions where it improves testability or replaceability.
- Keep dependency direction intentional and consistent.
- Avoid unnecessary third-party dependencies.
- Isolate external systems behind boundaries when it reduces coupling or improves reliability.

## 4. Concurrency and Correctness
- Identify shared mutable state and concurrent operations.
- Protect business invariants when multiple requests or processes modify the same resource.
- Consider race conditions, duplicate operations, and conflicting updates.
- Never rely on client-side validation alone for business rules.
- Define which component owns each important piece of state.
- Use eventual consistency only when its trade-offs are acceptable to the business.

## 5. Configuration
- Keep configuration separate from application logic; use the repo's existing mechanism.
- No environment-specific values hard-coded in business logic.
- Validate configuration at startup and fail clearly on missing or invalid values.
- Never place credentials or secrets in source code.

## 6. Scalability and Performance
- Design for measured requirements, not hypothetical traffic.
- Identify bottlenecks in computation, storage, network, memory, and concurrency.
- Avoid unnecessary synchronous dependencies and repeated work.
- Keep execution stateless where practical; store durable state in a shared system.
- Move suitable workloads to asynchronous processing.
- Consider capacity limits, contention, and operational cost.
- Avoid premature micro-optimization and unnecessary distributed complexity.

## 7. Architecture Decisions
For significant or hard-to-reverse decisions:
- State the problem, realistic alternatives, chosen approach, and trade-offs.
- Record assumptions, constraints, and consequences (a lightweight ADR where useful).
- Prefer reversible decisions when uncertainty is high.

## 8. Refactoring Rules
- Preserve existing behavior unless requirements change it.
- Make structural changes incrementally; no unrelated rewrites during feature work.
- Do not mix architectural changes with unrelated formatting or cleanup.
- Keep public interfaces compatible where required.
- Add or update tests that protect important behavior.

## 9. Architecture Fitness
Evaluate choices against: maintainability, reliability and failure isolation, security and data ownership, expected workload, operational complexity, cost, and team capability. Revisit decisions when evidence shows their assumptions no longer hold.

## 10. Completion Checklist
- [ ] Responsibilities and module boundaries are clear
- [ ] Dependencies follow an intentional direction
- [ ] Business invariants are protected
- [ ] Configuration fits all target environments
- [ ] Scalability choices match actual requirements
- [ ] Existing behavior and interfaces remain compatible
- [ ] Tests and documentation are updated
- [ ] Added complexity is justified

## Decision Rule
Choose the simplest architecture that satisfies current requirements while keeping reasonable paths for future change. Explain trade-offs; never claim one architecture is universally best.
