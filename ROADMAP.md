# 🗺️ Validador PYME SaaS — Master Engineering Roadmap

This roadmap defines the sequential development phases, deliverables, and acceptance criteria for the multi-tenant commercial edition of **Validador PYME SaaS**.

---

## 📌 Phase Summary

| Phase | Focus Area | Status | Deliverables |
|---|---|---|---|
| **Phase 1** | **Governance, Rules & Architecture** | `COMPLETED` | Git Repo, AGENTS.md, pipeline.md, ADR-001 through ADR-007 |
| **Phase 2** | **NestJS Clean Architecture Core & Multi-Tenancy** | `COMPLETED` | Domain entities, TenantContext, Tri-Tier RBAC & Organization Memberships |
| **Phase 3** | **Multi-Tenant Webhook Ingestion & Multi-Bank Parsers** | `COMPLETED` | Itaú, GNB, UENO, Familiar, Atlas, Continental parsers, Anti-Replay |
| **Phase 4** | **Merchant Onboarding & Approval Queue** | `COMPLETED` | Public signup form API, SuperAdmin approval workflow, Auto-provisioning |
| **Phase 5** | **Gs. 150.000/mo Subscription Billing & Dogfooding Engine** | `COMPLETED` | Alias SIPAP 5644334, Payment reporting, Incoming transfer matching & Auto-extension |
| **Phase 6** | **Premium Frontend SPA (React + Vite + Tailwind)** | `COMPLETED` | Fast-POS Cashier UI, Merchant Portal, SuperAdmin Dashboard, Responsive Mobile UI |
| **Phase 7** | **Testing & Production Readiness** | `COMPLETED (unit only)` | Jest unit suite (`npm test`), `tsc --noEmit`, backend/client builds, Docker Compose, env-driven seed. **No E2E harness exists.** |

---

## 📋 Detailed Task Breakdown

### 🎯 Phase 2: NestJS Core, PostgreSQL & Multi-Tenant RBAC with Organization Memberships
- [ ] Initialize NestJS project structure with strict Clean Architecture separation:
  - `src/core/domain/`: Pure entities (`Merchant`, `User`, `MerchantMembership`, `Transfer`, `Subscription`, `MerchantRequest`).
  - `src/core/application/`: Use cases with explicit `tenantId` contracts and membership resolution.
  - `src/infrastructure/`: PostgreSQL adapters (raw parameterized SQL via `pg`), repositories behind application ports.
  - `src/presentation/`: NestJS controllers, guards, interceptors.
- [ ] Database Schema Definition (Decoupled Identity & Memberships):
  - `users`: `id`, `email`, `password_hash`, `full_name`, `is_super_admin`, `created_at`.
  - `merchants`: `id`, `name`, `slug`, `webhook_secret`, `status`, `created_at`.
  - `merchant_memberships`: `id`, `user_id` (FK), `merchant_id` (FK), `role` (`MERCHANT_OWNER` | `CASHIER`), `is_active`. Unique index on `(user_id, merchant_id)`.
  - `transfers`: `id`, `tenant_id`, `operation_id`, `amount`, `payer_name`, `payer_bank`, `status`, `claimed_at`, `claimed_by_user_id`.
  - `subscriptions`: `id`, `tenant_id`, `status` (`trial`, `active`, `past_due`, `cancelled`), `expires_at`.
  - `merchant_requests`: `id`, `business_name`, `owner_name`, `email`, `phone`, `city`, `status`.
- [ ] Two-Stage Authentication & Multi-Store Selector (ADR-008):
  - `POST /api/v1/auth/login`: Validates credentials, returns user identity + array of active memberships.
  - Auto-select fast path if user belongs to 1 company.
  - `POST /api/v1/auth/select-tenant`: Issues tenant-scoped JWT with specific company role.
  - `POST /api/v1/auth/switch-tenant`: Allows instant company switching from the UI navigation bar without logging out.
- [ ] Implement `TenantContextInterceptor` & `TenantGuard`:
  - Enforce `tenant_id` extraction from scoped JWT claims for all operational routes.
  - Guarantee zero cross-tenant data leakage.
- [ ] Seed SuperAdmin account via environment variables (`SUPERADMIN_PASSWORD`, plus `DATABASE_URL` for the target database). The seed email is fixed in `seed-pilot.ts`; `SUPERADMIN_EMAIL` is not read.

---

### 🎯 Phase 3: Multi-Tenant Ingest Engine & Multi-Bank Parsers
- [ ] Dedicated Webhook Endpoint: `POST /api/v1/webhook/:tenantSlug`.
  - Validate merchant existence and subscription health.
  - Timing-safe verification of `X-Merchant-Webhook-Secret`.
- [ ] Expanded Multi-Bank Parsers (`BankParserFactory`):
  - **Banco Itaú Paraguay**: Direct and forwarded emails (`Debitado de:`, `Monto de la transferencia:`).
  - **Banco GNB Paraguay**: 30-digit vouchers and SIPAP references.
  - **UENO Bank**: Transaction IDs and mobile debit notifications.
  - **Banco Familiar**: `FAMIPYPAARES...` operation IDs and receipt codes.
  - **Banco Atlas**: `ATLAPYPAARES...` transfer receipts.
  - **Banco Continental**: SIPAP credit receipts.
- [ ] Anti-Replay Invariant:
  - Atomic claim transaction in PostgreSQL with `UPDATE ... WHERE id = $id AND tenant_id = $tenantId AND status = 'pending'`.
  - Immediate `already_claimed` alert with previous cashier timestamp.

---

### 🎯 Phase 4: Merchant Onboarding & SuperAdmin Approval Queue
> **Current state:** the implemented routes are `POST /api/v1/onboarding/request` (public application), `GET /api/v1/onboarding/superadmin/merchant-requests` (queue) and `POST /api/v1/onboarding/superadmin/merchant-requests/:id/approve` — all under the `onboarding` controller prefix, not a `superadmin` prefix. **No rejection endpoint and no reject action in the UI exist today**; declining an application is planned, not implemented. The bullets below are the planned API surface, and only the routes named in this note exist.
- [x] Public Application Endpoint: `POST /api/v1/onboarding/request`.
  - Captures business name, owner name, email, password, phone and city (there is **no** estimated-transfer-volume field).
- [ ] SuperAdmin Review Portal API:
  - `GET /api/v1/onboarding/superadmin/merchant-requests`: Queue of merchant requests. *(Implemented — returns the full list; no pagination or status filters.)*
  - `POST /api/v1/onboarding/superadmin/merchant-requests/:id/approve`: *(Implemented)*
    - Auto-generates merchant tenant and slug.
    - Generates 32-byte cryptographic webhook secret.
    - Provisions `MERCHANT_OWNER` user account.
    - Activates 7-day free trial.
  - **Rejection of an application — planned, not implemented**: there is no decline endpoint and no Reject button; no route or behavior is claimed for it here.

---

### 🎯 Phase 5: Subscription Billing Engine (manual, Gs. 150.000 reported)
> **Current state:** billing is manual (bank transfer + superadmin validation of the reported payment). No payment gateway, Stripe adapter, or `IPaymentGateway` implementation exists yet, and a `past_due` subscription does **not** suspend webhook ingestion or cashier verification in the backend — subscription status is never consulted there. The only effect is client-side: warning banners plus a disabled POS search submit while the subscription is `past_due` or `cancelled`. The items below are planned, not implemented.
- [ ] Pluggable Payment Provider Interface (`IPaymentGateway`):
  - **Stripe Adapter**: Recurring subscription checkout session (price not defined here; no gateway is integrated).
  - **Local Adapter (Pagopar / Bancard vPOS)**: Recurring debit / QR invoice in Guaraníes.
- [ ] Webhook Reconciliation:
  - Listens for payment confirmation / failure.
  - Updates merchant `subscription_status` (`trial` -> `active` -> `past_due`).
  - Auto-suspends webhook ingestion if subscription remains delinquent.

---

### 🎯 Phase 6: Premium Frontend SPA (React + Vite + Tailwind)
> **Current state:** the SPA is built, but it has **no client-side router** — `client/src/App.tsx` picks the view from the session state (landing / login / register, then Fast-POS, Owner or SuperAdmin by role), so the `/pos`, `/merchant` and `/superadmin` paths below are descriptive names, not real routes. Tailwind CSS is loaded from the Play CDN in `client/index.html` (no Tailwind build dependency). Items such as active-bank preferences, CSV/Excel export and a payment-method card are **not** implemented.
- [ ] **Design System & Shell**:
  - Sleek dark mode palette (`#0B0F19` deep slate + electric blue accents).
  - Web Audio API sound synthesizer (positive harmonic chime and low replay tone).
  - High-contrast typography optimized for bright retail checkout counters.
- [ ] **Cashier Fast-POS Screen (`/pos`)**:
  - Auto-formatted numeric amount input (`45000` -> `Gs. 45.000`).
  - Search by Amount + Client Name.
  - 1-Click "Confirmar y Cobrar" claim button.
  - Keyboard shortcuts (`Enter`, `Space`, `Esc`).
- [ ] **Merchant Portal (`/merchant`)**:
  - Cashier operators CRUD (create, reset password, toggle active).
  - Active bank preferences.
  - Full audit ledger with CSV/Excel export.
  - Subscription management and payment method card.
- [ ] **SuperAdmin Control Plane (`/superadmin`)**:
  - Pending merchant onboarding request cards (1-click Approve; Reject not implemented).
  - Global tenant directory with health and volume indicators.
  - System-wide transfer metrics and monthly recurring revenue (MRR) tracker.
- [ ] **Public Landing Page (`/`)**:
  - High-converting sales page explaining Problem vs Solution for retail owners.
  - Interactive simulator of the Fast-POS screen.
  - "Solicitar Acceso" onboarding form.

---

### 🎯 Phase 7: Verification, Security Audit & Cloud Blueprint
> **Current state:** all automated verification runs through the single Jest unit config (`npm test`), plus `npx tsc --noEmit`, `npm run build`, and `npm --prefix client run build`. There is **no E2E harness or E2E configuration** in this repository — the broken `test:e2e` script (pointing at a missing config file) was removed, so no E2E claim is valid. Docker Compose files exist for local and production (Nginx edge); `nginx -t` remains an operator validation step because no Nginx binary and no running Docker daemon are available in this environment.
- [ ] Comprehensive test suite:
  - Unit tests for all 6 bank parsers.
  - Multi-tenant boundary isolation E2E tests (verifying that Tenant A cannot read Tenant B's transfers under any condition).
  - Anti-replay concurrency tests (race condition verification).
- [ ] Docker compose & 1-click cloud deployment config (Render / Railway / Fly.io with PostgreSQL).
