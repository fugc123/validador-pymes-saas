# Feature: Factufy Electronic Invoicing + Multi-Store Owner Tabs + Branch Pricing

- **Branch**: `feat/factufy-and-multistore`
- **Engram mirror**: `odd/factufy-and-multistore/tasks` (pending sync)
- **TDD mode**: off (project uses Jest unit suites + `tsc --noEmit` + `npm run build` + `npm --prefix client run build`)
- **Delivery strategy**: `ask-on-risk`

## Objective
1. Integrate dynamic per-tenant Factufy API credentials (`clientId`, `clientSecret`, `branchCode`, `posCode`) for SIFEN electronic invoicing, RUC lookup, and KUDE PDF download.
2. Allow a `MERCHANT_OWNER` to operate multiple distinct stores (`Kiosco`, `Imprenta`, etc.) in tabs with separate catalogs/inventories/cashiers, sharing the same Google Apps Script webhook with cross-store anti-replay, at Gs. 150.000/month per store.
3. Add branches per store (`merchant_branches`), free up to 5 branches per store and +Gs. 50.000/month for each branch beyond the 5th.

## Checklist
- [x] **T1**: Update `schema.ts` & `sifen.ports.ts`, create `factufy.adapter.ts`, and update `sifen.repository.ts`, `sifen.controller.ts`, and `app.module.ts`. (`npx tsc --noEmit` passed)
- [x] **T2**: Implement multi-store creation, branch management + pricing helper (`5 free, +50k extra`), shared GAS webhook replication + cross-store anti-replay (`auth.ports.ts`, `in-memory.repositories.ts`, `ingest-webhook.use-case.ts`, `claim-transfer.use-case.ts`, `merchant.controller.ts`, `subscription.controller.ts`). (`npx tsc --noEmit` passed)
- [x] **T3**: Implement UI in `OwnerDashboard.tsx` (store tabs, new store modal, branches + pricing card), `SifenFreeMerchantModal.tsx` (Factufy dynamic fields), and `FastPosScreen.tsx` (RUC lookup button). (`npm --prefix client run build` passed)
- [ ] **T4**: Add unit tests in `test/unit/factufy-and-multistore.spec.ts` and run full verification (`tsc --noEmit`, `npm run build`, `npm --prefix client run build`, `npm test`).
