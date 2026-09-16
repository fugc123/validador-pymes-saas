# Universal 5-Phase Engineering Pipeline (Gentle AI + Ponytail SaaS Edition)

A deterministic, multi-tenant software engineering pipeline designed to provide continuous context and rigor to development while preventing over-engineering and architectural debt.

---

## Phase 1: Planning & Multi-Tenant Blast Radius (SDD)

- **Objective**: Establish complete context and evaluate tenant isolation before touching code.
- **Multi-Tenant Ingestion**:
  - Review historical Architecture Decision Records in `docs/adr/`.
  - Validate database schemas for `tenant_id` foreign keys and Row-Level Security.
  - Trace request lifecycle through NestJS `TenantContextInterceptor` and `TenantGuard`.
- **Deliverable**: Formal proposal in `implementation_plan.md` detailing:
  - Business context, user requirements, and threat modeling.
  - Structural impact on Domain, Application, Infrastructure, and Presentation layers.
  - File-by-file changes (`[NEW]`, `[MODIFY]`, `[DELETE]`).
  - Automated unit and E2E verification plan.

---

## Phase 2: Manual Approval (Human-in-the-Loop Gate)

- **Objective**: Human ownership and architectural governance.
- **Rule**: Stop and await explicit confirmation from the tech lead before proceeding.

---

## Phase 3: Execution and Ponytail Simplification (Anti-Bloat & YAGNI)

- **Objective**: Minimal, robust implementation adhering to Clean Architecture.
- **Rules**:
  - Respect Domain-Driven Design (DDD) layer isolation:
    - Domain entities contain state invariants (e.g. `transfer.claim()`).
    - Use cases orchestrate flows using injected repository interfaces (Ports).
    - NestJS modules encapsulate infrastructure adapters.
  - Enforce complexity pruning via the Ponytail suite:
    - `ponytail-review`: Strip speculative abstractions and unrequested boilerplate.
    - `ponytail-audit`: Audit for unneeded dependencies and file bloat.
    - `ponytail-debt`: Address root causes instead of patching symptoms.
    - `ponytail-gain`: Maximize functional value per line of code.

---

## Phase 4: Audit, Cybersecurity, and Defect Control

- **Objective**: Zero regressions, strict multi-tenant isolation, and automated defect control.
- **Mandatory Controls**:
  - **Static Typing**: 0 TypeScript errors (`tsc --noEmit`).
  - **Clean Build**: Production build succeeds with exit code 0 (`npm run build`).
  - **100% Test Coverage**: Unit tests for domain logic and E2E tests with Supertest (`npm test`).
  - **Cybersecurity & Multi-Tenant Boundaries**:
    - Query isolation: every SQL query MUST filter by `tenant_id`.
    - Input validation on all endpoints using `class-validator` and `ValidationPipe`.
    - Secure password hashing using Argon2id / PBKDF2 with unique salts.
    - JWT expiration, refresh mechanisms, and role hierarchy enforcement.
    - Anti-replay guards on bank transfer claims.

---

## Phase 5: Judgment Day, Walkthrough & Knowledge Sync

- **Objective**: Verified delivery and permanent memory persistence.
- **Delivery & Sync**:
  - `walkthrough.md`: Summary of changes, command outputs, and verified builds.
  - **ADR Generation**: Document architectural decisions in `docs/adr/` following standard MADR format.
  - **Persistent Memory Sync**: Update Engram memory topics for project coherence.
