# Feature: Digital Loyalty Cards & Coupons (Rondafy-style)

- **Branch**: `feat/loyalty-cards`
- **Engram mirror**: `odd/loyalty-cards/tasks` (pending sync)
- **TDD mode**: off (project uses unit tests with Jest `npm test` + `tsc --noEmit` + `npm run build` + `npm --prefix client run build`)
- **Delivery strategy**: `ask-on-risk`

## Objective
Implement Rondafy-style digital loyalty cards & coupons without requiring customer login:
- Each customer phone per tenant receives an unguessable `card_token` (`/fidelidad/:token`) shareable via WhatsApp.
- Entering a customer's phone on POS checkout automatically records 1 visit/stamp and issues a redeemable coupon when `stampsRequired` is reached.
- Owners configure the program, view customer cards/coupons, send WhatsApp card links in 1 click, and redeem coupons (also redeemable from POS).

## Checklist
- [x] **T1**: Add DB schema (`loyalty_programs`, `loyalty_cards`, `loyalty_coupons`), ports (`loyalty.ports.ts`), repository (`loyalty.repository.ts`), controller (`loyalty.controller.ts`), module wiring (`app.module.ts`), and auto-stamp hook on `POST /merchant/sales`. (`npx tsc --noEmit` passed)
- [x] **T2**: Add unit tests in `test/unit/loyalty.spec.ts` for auto-stamping, coupon generation at threshold, redemption, public token lookup, and tenant isolation. (`4 passed`)
- [x] **T3**: Create `client/src/portals/loyalty/PublicLoyaltyCardView.tsx` and wire `/fidelidad/:token` route in `client/src/App.tsx`.
- [ ] **T4**: Integrate loyalty phone auto-stamp & coupon redeem in `FastPosScreen.tsx` and owner **Fidelidad** tab in `OwnerCatalogAndSalesPanel.tsx`; run full verification.
