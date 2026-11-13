# Feature: Conditional Catalog Tabs & Service/Hotel Bookings

- **Branch**: `feat/catalog-bookings`
- **Engram mirror**: `odd/catalog-bookings/tasks` (pending sync)
- **TDD mode**: off (project uses unit tests with Jest `npm test` + `tsc --noEmit` + `npm run build` + `npm --prefix client run build`)
- **Delivery strategy**: `ask-on-risk` (forecast ~600 authored lines across 4 tasks)

## Objective
1. Hide `Productos` or `Servicios` filter buttons in `PublicCatalogView.tsx` when the store has 0 items of that type (and `Todos` when only one type exists).
2. Add service & hotel bookings (`hours` and `days` modes) configurable by the merchant owner (available days of week, time slots, max concurrent/rooms) and bookable by customers in the public catalog with required `customerName` and `customerPhone`.

## Checklist
- [x] **T1**: Add DB schema (`catalog_items` booking columns + `catalog_bookings`), ports (`catalog.ports.ts`), repository (`catalog.repository.ts`), and controller (`catalog.controller.ts`) endpoints. (`npx tsc --noEmit` passed)
- [ ] **T2**: Add unit tests for `hours` and `days` bookings, day-of-week validation, capacity conflict rejection, and tenant isolation in `test/unit/catalog-and-sales.spec.ts`.
- [ ] **T3**: Update `PublicCatalogView.tsx` to hide empty type filters and render the conditional `Reservas` tab and booking modal (requiring customer name & phone).
- [ ] **T4**: Update `OwnerCatalogAndSalesPanel.tsx` with service booking config (`hours`/`days`, days of week, slots, max concurrent) and `Reservas` management tab; run full verification suite.
