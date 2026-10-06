# 🏢 Validador PYME SaaS — Engineering Contract & Operating Rules

This repository contains the multi-tenant commercial SaaS edition of **Validador PYME**, an enterprise-grade, real-time bank transfer validation platform for retail merchants, kiosks, and SMEs across Latin America (Paraguay SIPAP / QR ecosystems).

All development and AI assistance in this workspace operate strictly under the unified principles of **Gentle AI** (clean hexagonal architecture, persistent memory, domain-driven design, structured workflows) and **Ponytail** (extreme YAGNI, senior developer minimalism, deletion over addition, zero bloat).

---

## 🚀 Mandatory 5-Phase Engineering Pipeline

Every feature, refactor, analysis, or architectural evolution in this project MUST strictly follow the 5-phase engineering pipeline:

### 1. PHASE 1 — Planning & Topological Impact (SDD)
- Evaluate structural blast radius before proposing modifications.
- Review historical Architecture Decision Records in `docs/adr/`.
- Verify domain invariants and boundaries (Tenants, Merchants, Users, Transfers, Audits, Subscriptions).
- 100% read-only codebase exploration. Zero file mutations during exploration.
- Produce formal specification in `implementation_plan.md` detailing:
  - Context and root-cause analysis.
  - Multi-tenant data isolation impact.
  - Exact file-by-file changes (`[NEW]`, `[MODIFY]`, `[DELETE]`).
  - Automated verification plan (unit suites; this repository has no E2E harness).

### 2. PHASE 2 — Manual Approval (Human-in-the-Loop Gate)
- STOP and wait for explicit human review and approval before touching code.

### 3. PHASE 3 — Execution & Ponytail Simplification (Anti-Bloat & YAGNI)
- Implement strictly necessary logic with Clean / Hexagonal Architecture:
  - **Domain**: Pure business entities, value objects, domain events, ports. Framework-agnostic.
  - **Application**: Use cases, command/query handlers, tenant scoping, DTOs.
  - **Infrastructure**: NestJS modules, database adapters (`pg` with parameterized SQL), database schemas, external bank parsers, manual billing reconciliation.
  - **Presentation**: REST controllers, guards, interceptors, webhooks.
- Enforce complexity pruning via Ponytail:
  - `ponytail-review`: Strip speculative abstractions and unrequested boilerplate.
  - `ponytail-audit`: Audit for unneeded dependencies and bundle bloat.
  - `ponytail-debt`: Address root causes instead of patching symptoms.
  - `ponytail-gain`: Maximize functional leverage per line of code.

### 4. PHASE 4 — Audit, Cybersecurity & Defect Control
- **Strict Static Typing**: 0 TypeScript errors (`tsc --noEmit`), no `any` bypasses, strict null checks.
- **Clean Build**: Production build succeeds cleanly with exit code 0 (`npm run build`).
- **100% Passing Tests**: All unit suites green (`npm test`). This repository has no E2E harness or E2E configuration; never claim E2E coverage (the stale `test:e2e` script pointed at a missing config and was removed).
- **OWASP Top 10 & Multi-Tenant Defense**:
  - Mandatory tenant context verification on every query (zero cross-tenant data leakage).
  - Input sanitization with strict schemas and `class-validator`.
  - Anti-replay cryptographic validation for transfer claims.
  - Zero hardcoded secrets in repository.
  - Rate limiting, helmet security headers, and brute-force protection.
- **As built today (requirements above remain in force)**: API rate limiting (`limit_req` zones) and security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`) are enforced at the Nginx edge (`client/nginx.conf`), not inside NestJS; production Compose requires explicit `DB_PASSWORD` and `JWT_SECRET` and does not publish the backend host port; billing is manual. The backend does not gate webhook ingestion on subscription status, while the POS client disables its search submission for `past_due` and `cancelled` and displays warnings. The Nginx config has only been validated by static assertions — `nginx -t` is an operator step (no Nginx binary and no Docker daemon are available in this environment). Current as-built status is recorded in `docs/adr/ADR-009-implementation-verification-status.md`.

### 5. PHASE 5 — Judgment Day, Walkthrough & Knowledge Sync
- Generate comprehensive `walkthrough.md` with verifiable evidence.
- Document lasting architectural choices as ADRs in `docs/adr/`.
- Sync persistent memory to maintain cross-session coherence.

---

## 🦹 Ponytail Decision Ladder

1. **Does this need to exist at all? (YAGNI)**
   If a feature, abstraction, or visual flourish is speculative or unasked, do NOT write it.
2. **Already in this codebase?**
   Search before writing. Reuse existing entities, services, guards, and utilities.
3. **Stdlib / Web Standard / Native platform covers it?**
   Favor native capabilities (Node.js `crypto`, Web Audio API, standard fetch) over external packages.
4. **Already-installed dependency covers it?**
   Do not introduce redundant dependencies if existing packages can solve it.
5. **Can it be one line?**
   If a clean one-liner solves the problem correctly, write the one-liner.
6. **Only then: write the minimum robust code that works.**
   Every line must justify its existence.

---

## 👥 Tri-Tier Role-Based Access Control (RBAC)

1. **SUPER_ADMIN (Platform Owner)**:
   - Global dashboard across all merchant tenants.
   - Merchant registration requests, onboarding approvals, subscription status.
   - Global system metrics, bank ingestion health, and audit logs.
2. **MERCHANT_OWNER (Business Owner / Kiosk Dueño)**:
   - Tenant-scoped configuration: custom bank preferences, active accounts.
   - Cashier operator management (create, edit credentials, deactivate).
   - Financial audit trail: claimed vs pending transfers, exportable summaries.
   - Subscription billing management (owner-reported transfers of Gs. 150.000 per month, validated manually by the platform owner).
3. **CASHIER (Punto de Venta Operator)**:
   - High-velocity point-of-sale verification screen.
   - Zero-Knowledge search by exact amount + customer name within 45m window.
   - One-click "Confirm & Claim" with audio chime feedback.
   - Zero access to merchant financials, personal emails, or other stores.

---

## 🛠 Developer Guide & Essential Information

For detailed project architecture, seed setup, and essential commands, please see [CLAUDE.md](./CLAUDE.md).

### Seed & Credentials (no published logins)
- `npm run seed:pilot` provisions only the system superadmin and the system tenant. It fails closed unless `DATABASE_URL` and `SUPERADMIN_PASSWORD` are provided; credentials come exclusively from the environment and are never printed or written to documentation.
- This repository ships no demo or test accounts. Never add passwords, seed values, or webhook secrets to any document, fixture, or script.
- The seed generates the system tenant webhook secret once and preserves it on rerun. Merchant owners read their persisted secret from the owner dashboard (never derived from the slug).

### Essential Commands
- Unit tests: `npm test` (single Jest config; `npm test -- --runInBand`, or `-- --runTestsByPath <file>` for a focused run). There is no E2E suite.
- Type check: `npx tsc --noEmit`.
- Backend build: `npm run build` or `npx nest build`.
- Backend dev server: `node dist/main.js` (port 3000, global prefix `/api/v1`).
- Frontend dev server: `npm --prefix client run dev` (port 5173, proxies `/api` to 3000).
- Frontend build: `npm --prefix client run build`.
