# Feature: Cashier Paginated Itinerary, Counter Booking Creation & Mobile POS Catalog Pagination

- **Branch**: `feat/cashier-itinerary-and-pos-pagination`
- **TDD mode**: off (Jest unit suites + `tsc --noEmit` + `npm run build` + `npm --prefix client run build`)

## Checklist
- [x] **T1**: Add cashier booking endpoints (`GET cashier/bookings`, `GET cashier/bookings/availability`, `POST cashier/bookings`, `PATCH cashier/bookings/:id/status`) in `src/presentation/controllers/catalog.controller.ts`.
- [x] **T2**: Create `client/src/portals/pos/CashierItineraryPanel.tsx` (paginated day/upcoming itinerary, status actions, pass-to-checkout, and counter `+ Nueva Reserva` modal) and update `client/src/portals/pos/FastPosScreen.tsx` (Agenda tab + mobile pagination of 6 items per page in catalog selector).
- [x] **T3**: Add cashier booking endpoint unit tests in `test/unit/catalog-and-sales.spec.ts`, run `npx tsc --noEmit`, `npm run build`, `npm --prefix client run build`, `npm test`, merge to `main`, and push. (33/33 suites, 372/372 tests passed)
