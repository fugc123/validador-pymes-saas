# Feature: Security Hardening, Production Demo Bootstrap & SIFEN Onboarding Flow

- **Branch**: `feat/security-and-sifen-onboarding`
- **Engram mirror**: `odd/security-and-sifen-onboarding/tasks` (pending sync)
- **TDD mode**: off (Jest unit suites + `tsc --noEmit` + `npm run build` + `npm --prefix client run build`)

## Checklist
- [x] **T1**: Add `secret-crypto.ts` (AES-256-GCM at rest), `sifen_onboarding_requests` schema + `factufy_client_secret` `TEXT` widening, `sifen.ports.ts`, `sifen.repository.ts` (`FACTUFY_DEMO_*` bootstrap, encryption, onboarding request flow, `findInvoiceByCdc`), and `sifen.controller.ts` (strict 44-digit CDC + ownership check on PDF download, merchant/superadmin request endpoints). (`npx tsc --noEmit` exit 0)
- [x] **T2**: Add booking `@Throttle` + strict DTO validation in `catalog.controller.ts` & `loyalty.controller.ts`, and 10-store cap in `merchant.controller.ts`. (`npx tsc --noEmit` exit 0)
- [x] **T3**: Update `FastPosScreen.tsx` (PDF KuDE download button + POS loyalty stamp lookup & coupon redeem), `OwnerDashboard.tsx` (SIFEN onboarding request card/modal), and `SuperAdminPanel.tsx` (SIFEN requests queue + approval action). (`npm --prefix client run build` exit 0)
- [ ] **T4**: Create `test/unit/security-and-sifen-onboarding.spec.ts`, run full verification (`npx tsc --noEmit`, `npm run build`, `npm --prefix client run build`, `npm test`), merge to `main`, and push.
