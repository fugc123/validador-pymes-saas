# Feature: SIFEN / consultame-sdk Electronic Invoicing Configuration & Test Emission for Free (Own) Merchants

## Objective
Implement SIFEN (`consultame-sdk`) electronic invoicing configuration and test/invoice generation restricted **exclusively to Free / Lifetime merchants** (`isLifetime === true`, i.e., the owner's own businesses), managed via a dedicated form with 1-click template autocompletion inside the SuperAdmin Panel (`SuperAdminPanel.tsx`) and integrated with POS sales for those merchants.

## Problem & Why
Companies that want to issue electronic invoices in Paraguay (SIFEN / DNIT) must provide their contributor data, timbrado, establishment, CSC, and digital certificate (`.p12`) for testing (`test` / `prod` environment). The user wants this capability restricted strictly to merchants created as **Free / Lifetime** (their own companies) and wants a form in the SuperAdmin Panel that they can fill out and autocomplete on behalf of those companies.

## Scope & Constraints
- **100% PostgreSQL Persistence**: Store SIFEN configurations (`sifen_configs`) and generated electronic invoice records (`sifen_invoices` with 44-digit CDC, XML/SOAP payload, status, and receptor RUC/CI) in PostgreSQL (`DDL_SCHEMA_SQL`).
- **Strict Eligibility Guard (`isLifetime` only)**: Backend must verify that the target merchant has a lifetime/free subscription (`external_customer_id = 'free-lifetime-partner'` or `current_period_end >= 2090`) before allowing SIFEN config save or invoice emission. Regular trial/paid merchants are rejected with `ForbiddenException`.
- **SuperAdmin Form with Autocomplete**: Provide a modal/panel in `SuperAdminPanel.tsx` for each Free Merchant with 1-click autocompletion of standard Paraguayan SIFEN defaults + `.p12` file upload + test invoice/RUC probe.
- **POS Integration for Enabled Free Merchants**: When a Free Merchant has SIFEN enabled, cashiers see optional Receptor RUC / Razón Social fields at checkout and can emit/view the SIFEN Electronic Invoice (CDC + KuDE preview).

## Actionable Checklist

- [x] **T1: PostgreSQL Schema, Domain & Repository for SIFEN Configs, CDC/XML Builder (`consultame-sdk` adapter) & Lifetime-Only Guard** (Commit: `1f28c61`)
  - Extended `DDL_SCHEMA_SQL` in `src/infrastructure/database/schema.ts` with `sifen_configs` and `sifen_invoices` tables.
  - Created ports and SIFEN / `consultame-sdk` service adapter (`src/core/application/ports/sifen.ports.ts` and `src/infrastructure/repositories/sifen.repository.ts`) enforcing the Free/Lifetime merchant eligibility rule, storing emitter parameters, building the official 44-digit Paraguayan CDC & SOAP/XML structure, and running test probes.
  - Added unit tests in `test/unit/sifen-invoicing.spec.ts`.

- [x] **T2: Backend Controllers for SuperAdmin SIFEN Management & Cashier Invoice Emission** (Commit: `f7c6c2a`)
  - Created `SifenController` (`src/presentation/controllers/sifen.controller.ts`) with:
    - `GET /api/v1/sifen/superadmin/configs` (`SUPER_ADMIN`)
    - `GET /api/v1/sifen/superadmin/config/:tenantId` (`SUPER_ADMIN`)
    - `PUT /api/v1/sifen/superadmin/config/:tenantId` (`SUPER_ADMIN` — enforces `isLifetime` check)
    - `POST /api/v1/sifen/superadmin/test-emission/:tenantId` (`SUPER_ADMIN` — tests SIFEN XML/SOAP generation & credentials for the company)
    - `GET /api/v1/sifen/cashier/status` & `POST /api/v1/sifen/cashier/emit` (`CASHIER`, `MERCHANT_OWNER`, `SUPER_ADMIN` — only if tenant is a free merchant with SIFEN active)
  - Registered in `src/app.module.ts` and verified with unit tests.

- [x] **T3: SuperAdmin SIFEN Autocomplete Form UI & Cashier POS Invoice Emission UI** (Commit: `fb27024`)
  - Created `client/src/portals/superadmin/SifenFreeMerchantModal.tsx` and updated `client/src/portals/superadmin/SuperAdminPanel.tsx` so Free/Lifetime merchants have a **"Configurar SIFEN / Autocompletar"** button opening the complete SIFEN form with **"✨ Autocompletar Plantilla Asunción"** & **"✨ Plantilla CDE / Alto Paraná"**, Modulo-11 RUC DV auto-calculator, `.p12` certificate uploader, and **"🧪 Probar Homologación SIFEN"** button.
  - Updated `client/src/portals/pos/FastPosScreen.tsx` so when the active merchant has SIFEN enabled, the cashier can enter Customer RUC / Razón Social and emit the SIFEN invoice (showing the 44-digit CDC).
  - Verified full backend + frontend builds and unit tests.

## Progress & Evidence
- T1 committed: `1f28c61`
- T2 committed: `f7c6c2a`
- T3 verified: `npm run build` and `npm --prefix client run build` succeeded (`✓ built in 2.01s`).
- RDD Mode: `disabled/unmanaged`.
