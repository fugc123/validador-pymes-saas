# Validador PYME SaaS — Project Context & Assistant Directives

This project is a high-performance commercial Multi-Tenant SaaS designed for Latin American retail businesses (kiosks, pharmacies, restaurants) to validate bank transfers (SIPAP / QR) in real time.

## Architecture
- **Backend**: NestJS with Clean Architecture (Ports & Adapters).
- **Frontend**: React + Vite + Tailwind CSS + Lucide Icons (Fast-POS Cashier UI + Merchant Portal + SuperAdmin Platform).
- **Data Layer**: PostgreSQL with multi-tenant row-level isolation (`tenant_id`).
- **Billing**: Recurring $15/month subscription engine.

## Core Rules
- Strictly follow the 5-phase pipeline in `pipeline.md`.
- Prioritize YAGNI and minimalism using the Ponytail ladder in `AGENTS.md`.
- All architectural decisions must be documented as ADRs in `docs/adr/`.
- Ensure zero cross-tenant data leakage.
