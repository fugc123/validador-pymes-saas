# ADR-009: Implementation & Verification Status (E2E, Persistence, Billing, Edge Controls)

- **Status**: `Accepted`
- **Date**: 2026-10-06
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Security Review
- **Relationship**: Clarifies (never edits) `ADR-001`, `ADR-006` and `ADR-008`, and corrects `docs/sdd/*` in place with explicit as-built notes

---

## Context and Problem Statement

Earlier ADRs are immutable (per `docs/adr/README.md`) and still describe intended capabilities as if they were present: mandatory automated **E2E** tenant-boundary tests (ADR-001, ADR-008), a unit-and-E2E verification contract (`docs/sdd/constitution.md`), and **pluggable payment adapters** such as `StripeBillingAdapter` / `LocalGatewayAdapter` (ADR-006, `docs/sdd/design.md`, which also names Drizzle/Prisma and Argon2id). The SDD documents are editable and now carry as-built notes; the ADRs are not.

Independent review found that a reader cannot tell requirement from as-built status: there is no E2E harness, no payment gateway, and no Postgres Row-Level Security in this repository. Recording the current status in a new ADR keeps the historical record intact while removing the false claims.

---

## Decision Drivers

1. **Never claim verification that cannot be executed locally.**
2. **Additive supersession**: accepted ADRs are never edited; a later ADR corrects the record.
3. **Requirement vs. as-built**: documents must label what the system should do separately from what it does today.

---

## Decision Outcome

**Chosen Solution: a single current-state status ADR that every verification-facing document links to.**

| Area | Requirement in historical docs | As built today (verified from source) |
|---|---|---|
| Test scope | Unit **and E2E** tests (`ADR-001`, `ADR-008`, `constitution.md`, `docs/sdd/README.md`) | **Unit tests only**: one Jest config (`jest.config.js`), `testRegex: '.*\.spec\.ts$'`, suites under `test/unit/`. No Playwright/Cypress config, no `test:e2e` script (it pointed at a missing config and was removed). |
| Persistence | Drizzle ORM / Prisma Client (`docs/sdd/design.md`) | Raw `pg` `Pool` with parameterized SQL through `DatabaseService`, plus checked-in DDL/migrations. In-memory repositories are used only when no database is configured (development). |
| Password hashing | Argon2id / PBKDF2 (`docs/sdd/design.md`) | `bcryptjs`. |
| Billing | Stripe + local gateway adapters (ADR-006, `design.md`) | **Manual reconciliation**: the owner reports a payment (`POST /api/v1/subscription/report-payment`) and `SUPER_ADMIN` validates it against an incoming transfer. No payment-gateway SDK is a dependency. **The backend never gates on subscription status**: webhook ingestion and cashier verify/claim do not read it. The only enforcement is client-side — `FastPosScreen` disables its search submit while the subscription is `past_due` or `cancelled`, plus warning banners. |
| Tenant isolation | "Row-Level Isolation" / PostgreSQL RLS (`ADR-001`; `GEMINI.md` repeated this until ADR-009 and now states RLS is **not** used) | **Application-level isolation**: every query is scoped by `tenant_id` with parameterized SQL. No `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` statement exists in the application schema or migrations. |
| Security controls in the request path | helmet + rate limiting in NestJS (`AGENTS.md` requirements) | Enforced at the **Nginx edge** (`client/nginx.conf`): `limit_req` zones for general and auth routes, plus `X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`, `Referrer-Policy`. NestJS itself has no helmet or throttler middleware. Production Compose requires explicit `DB_PASSWORD` and `JWT_SECRET` and does not publish the backend host port. |
| Edge-config runtime validation | — | `nginx -t` **was not executed**: no Nginx binary is available in this environment and pulling a container image was not authorized. Only static assertions over `client/nginx.conf` were run. |

---

## Consequences

- Unit-only verification and the absence of an E2E harness are now stated in `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `ROADMAP.md`, `pipeline.md` and `openspec/config.yaml`.
- This ADR is linked from `README.md`, `AGENTS.md`, `GEMINI.md`, `docs/adr/README.md`, and from the as-built notes in `docs/sdd/constitution.md`, `docs/sdd/README.md`, `docs/sdd/design.md`, `docs/sdd/spec.md` and `docs/sdd/tasks.md`.
- A future E2E harness or payment gateway is a **new** decision with its own ADR; nothing here forbids it, it is simply not built.
- **Pricing statements in older ADRs are historical.** `ADR-001`, `ADR-003`, `ADR-006` and `ADR-007` still quote a `$15/month` (USD) commercial price; those ADRs are immutable and keep that wording verbatim as a historical proposal. The current, displayed and reported amount is the manually reported **Gs. 150.000/month** (`POST /api/v1/subscription/report-payment`, validated by `SUPER_ADMIN`). No USD equivalence is asserted and **no future price** may be inferred from either statement.
- Reviewers reading ADR-001/006/008 must read this ADR for current status; those documents remain historical requirements and their as-built statements are superseded by this record.

## Compliance Checklist

- [x] No E2E harness, config, or script exists; no document claims E2E coverage.
- [x] Persistence and hashing described as `pg` + `bcryptjs`, matching source.
- [x] Billing described as manual with no gateway; `past_due` never gates the backend, and the only enforcement is the POS UI's client-side disabled search submit.
- [x] Security headers and rate limiting attributed to the Nginx edge, with `nginx -t` disclosed as not run.
- [x] Tenant isolation described as application-level `tenant_id` scoping, not Postgres RLS.
- [x] `.env.example` and other `.env*` files were deliberately neither read nor modified by this work; no claim is made about their contents.
