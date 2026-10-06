# CajaSegura (validador-pymes-saas) Developer Guide

## 1. Project Overview
- **CajaSegura (validador-pymes-saas)**: Anti-fraud SaaS for Paraguayan retail PYMEs, kiosks, and pharmacies.
- Solves the problem of fake bank transfer screenshots / comprobantes falsos SIPAP.
- Cashiers verify transfers in 2 seconds at the POS with audio chime feedback without accessing bank accounts or merchant financials.
- Pricing: Gs. 150.000 / month with 7-day free trial.

## 2. Architecture & Tech Stack
- **Backend**: NestJS 10, TypeScript, Clean/Hexagonal Architecture.
  - `src/core/domain/`: Pure domain entities (`Merchant`, `User`, `MerchantMembership`, `Transfer`, `Subscription`, `PaymentReport`, `MerchantRequest`).
  - `src/core/application/`: Use cases and abstract ports (`ports/auth.ports.ts`, `ports/transfer.ports.ts`, `ports/onboarding.ports.ts`).
  - `src/infrastructure/`: Repositories behind the application ports (`src/infrastructure/repositories/`, raw parameterized SQL through `pg` when a database is configured, in-memory store only for unconfigured development), multi-bank parsers (`src/infrastructure/parsers/`), and the persistence bootstrap (`src/infrastructure/database/`: `DatabaseService`, DDL schema, migrations, seed).
  - `src/presentation/`: NestJS controllers (`AuthController`, `CashierController`, `MerchantController`, `SubscriptionController`, `OnboardingController`, `WebhookController`), guards (`RolesGuard`, `TenantGuard`), middlewares (`AuthMiddleware`).
- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API chimes.
  - `client/src/portals/landing/`: High-converting public landing page (`LandingPage.tsx`).
  - `client/src/portals/pos/`: High-velocity cashier screen (`FastPosScreen.tsx`).
  - `client/src/portals/owner/`: Merchant owner dashboard with live financial metrics, live transfer audit, Google Apps Script wizard, and embedded validation environment (`OwnerDashboard.tsx`).
  - `client/src/portals/superadmin/`: Platform admin panel with request queue, subscription controls, and SIPAP payment validation (`SuperAdminPanel.tsx`).
  - `client/src/context/`: Multi-tenant auth context (`AuthContext.tsx`).

## 3. Dogfooding Subscription Payment Engine
- Merchants transfer Gs. 150.000 monthly to Alias: `5644334` (Franco Girala).
- In `OwnerDashboard`, owner reports payment via "Fui yo ([Nombre])" or custom payer name (`POST /api/v1/subscription/report-payment`).
- In `SuperAdminPanel`, admin clicks "🔍 Validar Recepción SIPAP" (`POST /api/v1/subscription/validate-payment-report/:id`).
- The backend checks incoming transfers in `cajasegura-platform`. If a match of Gs. 150.000 is found, it atomically claims the transfer and auto-extends the merchant's subscription by +30 days (`active`).
- Cashiers only see expiration warning alerts (trial / renewal approaching) with NO banking transfer details.
- Billing is manual: there is no payment gateway / Stripe integration. The owner reports a transfer and the superadmin validates it against incoming SIPAP transfers before the subscription is extended.
- `past_due` is informational only: the backend never blocks webhook ingestion or cashier verification on subscription status. The UI shows warning banners, and the POS disables its search submit client-side while the subscription is `past_due` or `cancelled`.

## 4. Seed & Credentials (no published logins)
- `npm run seed:pilot` provisions only the system superadmin and the system tenant. It requires `DATABASE_URL` and `SUPERADMIN_PASSWORD` from the environment and fails closed when either is missing; credentials are never printed or stored in docs.
- There are no demo/test accounts in this repository. Merchant owners read their persisted webhook secret from the owner dashboard (never derived from the slug).

## 5. Essential Commands
- Unit tests: `npm test` (single Jest config; `npm test -- --runInBand`, or `-- --runTestsByPath <file>` for a focused run). There is no E2E suite or E2E config in this repository.
- Type check: `npx tsc --noEmit`.
- Backend build: `npm run build` or `npx nest build`.
- Backend dev server: `node dist/main.js` (port 3000, global prefix `/api/v1`).
- Frontend dev server: `npm --prefix client run dev` (port 5173, proxies `/api` to 3000).
- Frontend build: `npm --prefix client run build`.

## 6. Key Guidelines
- Hexagonal architecture: Never import presentation or infrastructure into domain or application layers.
- NestJS DI uses string tokens for ports (e.g. `@Inject('ITransferRepository')`).
- ValidationPipe has `whitelist: true, forbidNonWhitelisted: true` -> ALL DTO properties MUST have `class-validator` decorators.
- Conventional commits only. Never add AI attribution.
