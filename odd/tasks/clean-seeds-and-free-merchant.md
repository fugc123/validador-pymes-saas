# Feature: Clean Fake Seeds & SuperAdmin Free Permanent Merchant Creation

## Objective
Purge all mock/demo seed data from the application and database (leaving only Platform SuperAdmin), and provide a dedicated SuperAdmin workflow to register and provision permanent 100% free lifetime merchant owners for VIP/pilot partners.

## Problem & Context
The current deployment contains hardcoded sample stores (Kiosko San Roque, Farmacia Central), fake users (Franco, Carlos), and synthetic bank transfers. To launch for real users, all mock data must be eradicated. Additionally, the platform administrator needs the capability to grant free lifetime access to strategic partners/friends without billing harassment, expiration banners, or trial countdowns.

## Scope
1. **Purge Seeders**: Clean in-memory repositories and PostgreSQL database tables of all fake merchants, users, transfers, and memberships, preserving strictly `admin@validador.com` (SuperAdmin) and `cajasegura-platform` (system tenant).
2. **Backend Domain & Use Case**: Add `CreateFreeMerchantUseCase` (or extend onboarding) allowing SuperAdmin to create a business, owner user, active membership, and a lifetime subscription (`status: 'active'`, `currentPeriodEnd: 2099-12-31`, `isLifetime: true`).
3. **API Endpoint**: `POST /api/v1/onboarding/superadmin/create-free-merchant` with SuperAdmin role guard.
4. **UI Updates**:
   - `SuperAdminPanel.tsx`: Modal to create free permanent merchant accounts with instant feedback.
   - `OwnerDashboard.tsx` & `FastPosScreen.tsx`: Recognize lifetime accounts, display "Plan Bonificado Permanente (Cortesía)" and suppress all payment banners.
5. **Production Deploy**: Sync and deploy changes to VPS `67.205.168.176`, run migrations/cleanup, restart PM2, and verify live.

## Tasks
- [ ] **TASK-01**: Clean fake seed data in `in-memory.repositories.ts` (users, merchants, memberships, transfers, subscriptions).
- [ ] **TASK-02**: Implement `CreateFreeMerchantUseCase` and DTOs in backend with tests.
- [ ] **TASK-03**: Expose `POST /api/v1/onboarding/superadmin/create-free-merchant` in `OnboardingController`.
- [ ] **TASK-04**: Update `SuperAdminPanel.tsx` with "➕ Crear Comercio / Dueño Gratuito" modal and action.
- [ ] **TASK-05**: Update `OwnerDashboard.tsx` & `FastPosScreen.tsx` to display lifetime plan badges and suppress payment alerts.
- [ ] **TASK-06**: Verify unit tests and production build locally.
- [ ] **TASK-07**: Deploy to VPS `67.205.168.176`, clear database tables, restart PM2, and verify live in production.

## Applicable Checks
- Automated unit tests passing (Jest)
- Production Vite build clean (`npm run build`)
- SuperAdmin login works with clean DB
- Create free merchant works via UI/API
- Login with new free owner shows lifetime plan with 0 payment reminders
