# Feature: POS Checkout, Inventory/Services with Time Discounts, Admin Movements & Public Storefront Catalog

## Objective
Expand CajaSegura from a transfer-only verifier into a complete lightweight POS & Inventory SaaS with:
1. Cashier pre-checkout screen supporting both **Catalog Cart** (products/services) and **Quick Amount ("Monto Libre + Qué pasó")**, with payment method selection (`TRANSFER`, `CASH`, `CARD`) and automatic stock deduction.
2. Inventory of **Products** (with stock) and **Services**, supporting **time-based discounts** (by hours or days) and optional photo.
3. Merchant Admin (`OwnerDashboard`) panels for **Inventory & Services management** and **Sales/Movements audit log** (who sold what, how they paid, concept, and linked transfer).
4. **Public Storefront Catalog** (`/catalogo/:slug`) with merchant-selectable color palette, rendering photo cards when an item has an image or clean typographic cards (name, price, discount, quantity) when it does not.

## Problem & Why
Merchants and cashiers need full visibility and control over every sale in the shop—not just isolated bank transfers—knowing which cashier performed each sale, what items or quick concepts were charged, what payment method was used, automatically discounting product inventory, and offering customers a customizable public product/service catalog link.

## Scope & Constraints
- **100% PostgreSQL Persistence**: All catalog items, theme settings, sales, and sale items must be persisted in PostgreSQL (`DDL_SCHEMA_SQL` + repository queries) with full dual-mode support in `InMemory...` repositories for unit tests.
- **No Electronic Invoicing (SIFEN) yet**: Internal sales & inventory control only.
- **Multi-Tenant Isolation**: Every catalog item and sale is strictly scoped by `tenant_id`. Public catalog exposes only active items for the target merchant `slug`.
- **TDD / Verification Mode**: Standard functional & unit test verification via `npx jest` and frontend TypeScript/Vite build via `npm run build`.
- **Delivery Forecast & Strategy**: ~950 authored lines across 3 tasks; strategy: `single-pr` on `feat/pos-inventory-catalog` (and deployable to `main`).

## Actionable Checklist

- [x] **T1: PostgreSQL Schema, Domain Entities, Ports & Repository for Catalog, Time Discounts & Sales**
  - Extend `DDL_SCHEMA_SQL` in `src/infrastructure/database/schema.ts` with `catalog_theme` on `merchants`, `catalog_items` table, `sales` table, and `sale_items` table.
  - Create domain/application models and ports (`src/core/application/ports/catalog.ports.ts`) with active time-discount calculation (`hours` expiration window and `days` of week / duration).
  - Implement PostgreSQL + fallback persistence (`src/infrastructure/repositories/catalog.repository.ts`) with atomic stock deduction and sale recording.
  - Add unit tests in `test/unit/catalog-and-sales.spec.ts`.
  - Evidence: Commit `39f481b` (`10 passed` across `database-schema.spec.ts` and `catalog-and-sales.spec.ts`).

- [x] **T2: Backend Controllers & Endpoints (Merchant Inventory/Movements, Cashier Sales & Public Catalog)**
  - Create `CatalogController` and `PublicCatalogController` (`src/presentation/controllers/catalog.controller.ts`) for:
    - Owner endpoints (`/api/v1/merchant/catalog`, `/api/v1/merchant/catalog/:id`, `/api/v1/merchant/catalog-theme`, `/api/v1/merchant/sales`)
    - Cashier endpoints (`/api/v1/cashier/catalog`, `/api/v1/cashier/sales`) integrating with SIPAP transfer claiming when `paymentMethod === 'TRANSFER'`
    - Public unauthenticated endpoint (`GET /api/v1/public/catalog/:slug`)
  - Register in `src/app.module.ts` and verify with unit/integration tests (`5 passed` in `test/unit/catalog-and-sales.spec.ts`).

- [ ] **T3: Frontend Cashier Pre-Screen POS, Owner Inventory/Movements Panels & Public Storefront**
  - Create `client/src/portals/catalog/PublicCatalogView.tsx` and route `/catalogo/:slug` (and `?catalogo=:slug`) in `client/src/App.tsx` with customizable color palettes (`emerald`, `indigo`, `rose`, `amber`, `cyan`, `violet`) and conditional photo vs. text-only cards.
  - Upgrade `client/src/portals/pos/FastPosScreen.tsx` with the Cashier Pre-Screen: Catalog Cart mode + Quick Amount ("Monto Libre + Qué pasó") mode, payment method selector (`Transferencia SIPAP`, `Efectivo`, `Tarjeta`), seamless transition to the SIPAP transfer radar when `Transferencia` is chosen, and shift sales history.
  - Upgrade `client/src/portals/owner/OwnerDashboard.tsx` with tabs for **Inventario y Servicios** (create/edit products & services, time discounts by hours/days, photo optional, public link & color palette picker) and **Movimientos / Ventas** (full audit table of sales by cashier).
  - Verify full backend + frontend production builds and tests.

## Progress & Evidence
- Status: T1 & T2 completed and verified.
- Next Step: Execute T3.
