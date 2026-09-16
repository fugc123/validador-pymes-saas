# ADR-001: Multi-Tenant Architecture & Data Isolation Model

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Security Lead, Product Operations

---

## Context and Problem Statement

The open-source edition of *Validador de Transferencias para PYMEs* was architected as a single-tenant deployment using an embedded SQLite database (`node:sqlite`). While optimal for individual store self-hosting, expanding into a commercial SaaS platform serving hundreds of retail businesses, pharmacies, and kiosks at $15/month requires a robust multi-tenant architecture.

The core challenge is ensuring absolute data isolation: under no circumstances may one merchant (e.g. Kiosko San Roque) access, query, or observe bank transfers, customer payment details, or turnover belonging to another merchant (e.g. Farmacia Central).

---

## Decision Drivers

1. **Absolute Data Confidentiality**: Financial transfer records and customer identification must remain strictly isolated.
2. **Horizontal Scalability**: Support hundreds of concurrent merchants and thousands of daily transfer claims with sub-50ms latency.
3. **Operational Simplicity**: Avoid managing hundreds of distinct database connections or database files on disk in serverless/containerized clouds.
4. **Clean Architecture Isolation**: Multi-tenant scoping should be handled at the application/infrastructure layer without polluting pure domain entities.

---

## Considered Options

1. **Option 1: Database-per-tenant (Separate SQLite / LibSQL databases per merchant)**:
   - *Pros*: Physical isolation, independent backups per merchant.
   - *Cons*: High connection management overhead on cloud containers, complex migration pipelines across 500+ databases.
2. **Option 2: Schema-per-tenant (PostgreSQL schemas per merchant)**:
   - *Pros*: Logical separation inside one PostgreSQL instance.
   - *Cons*: Schema migration complexity, connection pooling overhead.
3. **Option 3: Shared Database with Discriminator Column (`tenant_id`) and Row-Level Security (RLS)**:
   - *Pros*: Highly scalable, unified migrations, standard connection pooling (PgBouncer), straightforward analytics for SuperAdmin.
   - *Cons*: Requires rigorous NestJS interceptors and automated query filters to eliminate human developer error.

---

## Decision Outcome

**Chosen Option: Option 3 — Shared PostgreSQL Database with Indexed `tenant_id` and NestJS Scoped Interceptors.**

### Architectural Invariants:

1. **Every Multi-Tenant Entity possesses a `tenant_id`**:
   - Tables: `merchants`, `users`, `transfers`, `bank_accounts`, `audit_logs`.
   - Every foreign key to a merchant is indexed: `CREATE INDEX idx_transfers_tenant_id ON transfers(tenant_id);`.

2. **NestJS Tenant Context Resolution**:
   - An incoming HTTP request passes through `TenantContextInterceptor`.
   - The interceptor extracts the authenticated user's `tenant_id` from their cryptographically verified JWT claims (or resolves the merchant slug from the public webhook URL).
   - The `tenant_id` is placed into an asynchronous execution context (`AsyncLocalStorage`), ensuring all downstream use cases and repository methods implicitly or explicitly constrain their SQL queries by `tenant_id`.

3. **Repository Guard Rails**:
   - All repository query methods require `tenantId: string` as an explicit parameter (e.g. `findByAmountAndName(tenantId, amount, name, windowMinutes)`).
   - Direct cross-tenant queries are structurally disallowed at compile-time and runtime.

---

## Consequences

### Positive:
- Single unified PostgreSQL database (e.g., hosted on Neon or Supabase) with zero connection sprawl.
- SuperAdmin can view global platform analytics (total volume, active stores) without executing cross-database joins.
- Instant merchant provisioning: creating a new tenant requires only an `INSERT INTO merchants` rather than provisioning new schemas or database files.

### Negative / Risks:
- A developer writing an un-scoped query (`SELECT * FROM transfers`) could theoretically leak records across tenants.
- **Mitigation**: Enforced repository contracts, mandatory automated E2E tenant boundary tests, and pre-commit static analysis checks.
