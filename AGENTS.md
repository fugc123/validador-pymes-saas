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
  - Automated unit and E2E verification plan.

### 2. PHASE 2 — Manual Approval (Human-in-the-Loop Gate)
- STOP and wait for explicit human review and approval before touching code.

### 3. PHASE 3 — Execution & Ponytail Simplification (Anti-Bloat & YAGNI)
- Implement strictly necessary logic with Clean / Hexagonal Architecture:
  - **Domain**: Pure business entities, value objects, domain events, ports. Framework-agnostic.
  - **Application**: Use cases, command/query handlers, tenant scoping, DTOs.
  - **Infrastructure**: NestJS modules, database adapters, ORM schemas, external bank parsers, payment gateways.
  - **Presentation**: REST controllers, guards, interceptors, webhooks.
- Enforce complexity pruning via Ponytail:
  - `ponytail-review`: Strip speculative abstractions and unrequested boilerplate.
  - `ponytail-audit`: Audit for unneeded dependencies and bundle bloat.
  - `ponytail-debt`: Address root causes instead of patching symptoms.
  - `ponytail-gain`: Maximize functional leverage per line of code.

### 4. PHASE 4 — Audit, Cybersecurity & Defect Control
- **Strict Static Typing**: 0 TypeScript errors (`tsc --noEmit`), no `any` bypasses, strict null checks.
- **Clean Build**: Production build succeeds cleanly with exit code 0 (`npm run build`).
- **100% Passing Tests**: All unit and E2E suites green (`npm test`).
- **OWASP Top 10 & Multi-Tenant Defense**:
  - Mandatory tenant context verification on every query (zero cross-tenant data leakage).
  - Input sanitization with strict schemas and `class-validator`.
  - Anti-replay cryptographic validation for transfer claims.
  - Zero hardcoded secrets in repository.
  - Rate limiting, helmet security headers, and brute-force protection.

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
   - Subscription billing management ($15/month tier).
3. **CASHIER (Punto de Venta Operator)**:
   - High-velocity point-of-sale verification screen.
   - Zero-Knowledge search by exact amount + customer name within 45m window.
   - One-click "Confirm & Claim" with audio chime feedback.
   - Zero access to merchant financials, personal emails, or other stores.
