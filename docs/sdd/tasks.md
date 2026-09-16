# 🔨 Implementation Tasks (TASKS) — Validador PYME SaaS

- **Document Version**: `1.0.0`
- **Status**: `Active / Ready for Execution`
- **Derives from**: `constitution.md`, `spec.md`, `design.md`

---

## 🎯 Task Execution Rules
1. **Strict Dependency Order**: A task cannot be started until all of its dependencies (`Depends On`) are verified green.
2. **Test-First / Test-Driven**: Every task specifies its automated test assertion. A task is not done until its test passes with zero warnings.
3. **Ponytail Check**: Before completing any task, prune unneeded imports, uncalled functions, and dead parameters.

---

## 📋 Task Directory

### 📦 SPRINT 1: Core Domain, PostgreSQL Schema & Multi-Tenant Context

#### `[T01]` [COMPLETED] NestJS Project Scaffolding & Hexagonal Directory Layout
- **Phase**: Domain Foundation
- **Target Files**: `package.json`, `tsconfig.json`, `src/core/`, `src/infrastructure/`, `src/presentation/`
- **Depends On**: None
- **Description**: Initialize NestJS with TypeScript strict mode (`noImplicitAny`, `strictNullChecks`). Structure folders by hexagonal layers (Domain, Application, Infrastructure, Presentation).
- **Verification**: `npm run build` succeeds with 0 errors.

#### `[T02]` [COMPLETED] Pure Domain Entities & Invariants
- **Phase**: Domain Logic
- **Target Files**: `src/core/domain/entities/*.entity.ts` (`Merchant`, `User`, `MerchantMembership`, `Transfer`, `Subscription`, `MerchantRequest`)
- **Depends On**: `T01`
- **Description**: Create immutable TypeScript domain classes. Implement state methods: `transfer.claim()`, `subscription.isActive()`.
- **Verification**: Unit tests in `test/unit/domain-entities.spec.ts` testing state transitions and invariant violations.

#### `[T03]` [COMPLETED] PostgreSQL DDL Schema & Drizzle/Prisma Client
- **Phase**: Infrastructure Persistence
- **Target Files**: `src/infrastructure/database/schema.ts`, `src/infrastructure/database/database.module.ts`
- **Depends On**: `T02`
- **Description**: Implement tables for `merchants`, `users`, `merchant_memberships`, `transfers`, `subscriptions`, `merchant_requests` with indexes on `tenant_id` and unique constraints.
- **Verification**: Migration scripts execute cleanly; schema inspection verifies foreign keys and unique indexes.

#### `[T04]` [COMPLETED] TenantContextInterceptor & Scoped Execution
- **Phase**: Security & Multi-Tenancy
- **Target Files**: `src/presentation/interceptors/tenant-context.interceptor.ts`, `src/presentation/guards/tenant.guard.ts`
- **Depends On**: `T03`
- **Description**: Implement `AsyncLocalStorage` tenant context injector. Guarantee that any request missing or attempting cross-tenant access is rejected with `403 Forbidden`.
- **Verification**: Unit tests in `test/unit/tenant-context.spec.ts` verifying isolation.

---

### 📦 SPRINT 2: Authentication & Organization Memberships (ADR-008)

#### `[T05]` [COMPLETED] Two-Stage Authentication Use Cases
- **Phase**: Application Layer
- **Target Files**: `src/core/application/use-cases/auth/*.ts` (`LoginUseCase`, `SelectTenantUseCase`, `SwitchTenantUseCase`)
- **Depends On**: `T04`
- **Description**: Implement credential verification, multi-membership resolution, fast-path auto-select, and scoped JWT issuance.
- **Verification**: Unit tests in `test/unit/auth-memberships.spec.ts` covering single-store, multi-store, and invalid switch attempts.

#### `[T06]` [COMPLETED] Tri-Tier RBAC Guards (SuperAdmin, MerchantOwner, Cashier)
- **Phase**: Presentation Layer
- **Target Files**: `src/presentation/guards/roles.guard.ts`, `src/presentation/decorators/roles.decorator.ts`
- **Depends On**: `T05`
- **Description**: Implement role evaluation based on scoped JWT claims.
- **Verification**: Unit & E2E tests verifying that `CASHIER` cannot hit merchant admin routes while `MERCHANT_OWNER` and `SUPER_ADMIN` have appropriate authorization.

---

### 📦 SPRINT 3: Multi-Tenant Ingest & Multi-Bank Parsers

#### `[T07]` [COMPLETED] Multi-Bank Strategy Parsers (6 Banks)
- **Phase**: Infrastructure Parsers
- **Target Files**: `src/infrastructure/parsers/*.ts` (Itaú, GNB, UENO, Familiar, Atlas, Continental)
- **Depends On**: `T02`
- **Description**: Implement regex parsers with HTML entity decoding, whitespace normalization, and amount extraction.
- **Verification**: Unit test suite `test/unit/multi-bank-parsers.spec.ts` validating sample emails from all 6 banks.

#### `[T08]` [COMPLETED] Dedicated Per-Tenant Webhook & Idempotent Ingestion
- **Phase**: Webhook Engine
- **Target Files**: `src/presentation/controllers/webhook.controller.ts`, `src/core/application/use-cases/ingest-webhook.use-case.ts`
- **Depends On**: `T07`, `T04`
- **Description**: Route `POST /api/v1/webhook/:tenantSlug`. Validate secret with `timingSafeEqual`. Handle `(tenant_id, operation_id)` unique collision gracefully (HTTP 200 `already_exists`).
- **Verification**: Unit & integration test verifying creation, duplicate delivery, and secret validation.

---

### 📦 SPRINT 4: Cashier Fast-POS & Anti-Replay Engine

#### `[T09]` [COMPLETED] Verify & Claim Use Cases with Atomic SQL Lock
- **Phase**: Application Layer
- **Target Files**: `src/core/application/use-cases/transfers/verify-transfer.use-case.ts`, `claim-transfer.use-case.ts`
- **Depends On**: `T08`
- **Description**: Search pending transfers by amount and name. Atomic SQL claim update. Replay detection returns `already_claimed` with prior timestamp.
- **Verification**: Unit tests simulating claim, diacritic search, 45-min expiry, and replay detection with prior timestamp.

#### `[T10]` [COMPLETED] Cashier POS REST Endpoints
- **Phase**: Presentation Layer
- **Target Files**: `src/presentation/controllers/cashier.controller.ts`
- **Depends On**: `T09`, `T06`
- **Description**: `POST /api/v1/cashier/transfers/verify` and `POST /api/v1/cashier/transfers/claim`.
- **Verification**: Tested POS endpoints under RolesGuard and TenantGuard.

---

### 📦 SPRINT 5: Onboarding Queue & $15/mo Subscription Billing

#### `[T11]` [COMPLETED] Public Merchant Request & SuperAdmin Approval Workflow
- **Phase**: Commercial Onboarding
- **Target Files**: `src/core/application/use-cases/onboarding/*.ts`, `src/presentation/controllers/onboarding.controller.ts`
- **Depends On**: `T05`
- **Description**: Public signup form API + SuperAdmin approval transaction (provisions merchant, owner user, membership, 7-day trial).
- **Verification**: Unit & integration test verifying full application submission and approval flow.

#### `[T12]` [COMPLETED] Subscription Billing Engine ($15/mo)
- **Phase**: Billing Integration
- **Target Files**: `src/core/application/use-cases/billing/*.ts`
- **Depends On**: `T11`
- **Description**: Subscription lifecycle management ($15/mo) covering trial, payment confirmation, and past-due transitions.
- **Verification**: Unit tests verifying state machine transitions on payment events.

---

### 📦 SPRINT 6: Premium Frontend SPA (React + Vite + Tailwind)

#### `[T13]` [COMPLETED] Frontend Scaffolding, Design Tokens & Auth State
- **Phase**: Client Shell
- **Target Files**: `client/src/` (Vite, React 18, Tailwind CSS, Lucide Icons)
- **Depends On**: `T05`
- **Description**: Dark slate design system (`#0B0F19`), token management, and Organization Selector Modal.
- **Verification**: Frontend builds with 0 TypeScript/lint errors.

#### `[T14]` [COMPLETED] Cashier Fast-POS Screen with Web Audio Chimes
- **Phase**: Client POS
- **Target Files**: `client/src/portals/pos/FastPosScreen.tsx`, `client/src/utils/audio-synthesizer.ts`
- **Depends On**: `T13`, `T10`
- **Description**: High-velocity amount input, keyboard shortcuts (`Enter`, `Space`), green match card, red replay alert, synthesized Web Audio chime.
- **Verification**: Production build compiles with 0 errors; Web Audio synthesis verified for positive chime and dissonant alert.

#### `[T15]` [COMPLETED] Merchant Portal & SuperAdmin Control Plane
- **Phase**: Client Portals
- **Target Files**: `client/src/portals/merchant/`, `client/src/portals/superadmin/`
- **Depends On**: `T13`, `T11`, `T12`
- **Description**: Merchant cashier management and audit ledger; SuperAdmin onboarding queue with 1-click approvals and MRR metrics.
- **Verification**: Integrated into Client SPA across all 3 portals (Cashier, Owner, SuperAdmin).
