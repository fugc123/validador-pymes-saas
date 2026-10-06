# Validador PYME SaaS — Project Context & Assistant Directives

This project is a high-performance commercial Multi-Tenant SaaS designed for Latin American retail businesses (kiosks, pharmacies, restaurants) to validate bank transfers (SIPAP / QR) in real time.

## Architecture
- **Backend**: NestJS with Clean Architecture (Ports & Adapters).
- **Frontend**: React + Vite + Tailwind CSS + Lucide Icons (Fast-POS Cashier UI + Merchant Portal + SuperAdmin Platform).
- **Data Layer**: PostgreSQL accessed through raw `pg` with parameterized SQL (no ORM). Multi-tenant isolation is **application-level**: every query is scoped by `tenant_id`. Postgres Row-Level Security is **not** used.
- **Billing**: Manual reconciliation of the reported monthly transfer of **Gs. 150.000** — the owner reports a payment and the superadmin validates it against an incoming transfer. There is no payment gateway (no Stripe or local gateway integration). Subscription status is **not enforced by the backend**: webhook ingestion and cashier verify/claim never read it. The only effect is client-side — the POS screen disables its search submit while the subscription is `past_due` or `cancelled`, and shows warning banners.
- **Passwords**: hashed with `bcryptjs`.

## Verification Status (read before trusting older docs)
- Tests are **unit-only** (single Jest config, suites in `test/unit/`). There is no E2E harness or E2E configuration; `test:e2e` was removed because it pointed at a missing config. Never claim E2E coverage.
- Security headers and rate limiting are enforced at the **Nginx edge** (`client/nginx.conf`), not inside NestJS. `nginx -t` was not run here (no Nginx binary locally); only static assertions over the config exist.
- Current as-built status is recorded in [`docs/adr/ADR-009-implementation-verification-status.md`](docs/adr/ADR-009-implementation-verification-status.md), which supersedes the historical E2E/payment-adapter claims in ADR-001, ADR-006 and ADR-008 without editing them.

## Core Rules
- Strictly follow the 5-phase pipeline in `pipeline.md`.
- Prioritize YAGNI and minimalism using the Ponytail ladder in `AGENTS.md`.
- All architectural decisions must be documented as ADRs in `docs/adr/`.
- Ensure zero cross-tenant data leakage.
