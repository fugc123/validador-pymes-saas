# Architecture Decision Records (ADRs) — Validador PYME SaaS

This directory contains the immutable, historical Architecture Decision Records for the multi-tenant SaaS edition of Validador PYME. Decisions are tracked using a modified MADR (Markdown Architectural Decision Records) structure to provide long-term continuity across all engineering sessions.

---

## 📑 ADR Registry Index

| ADR ID | Title | Status | Date | Core Scope |
|---|---|---|---|---|
| **[ADR-001](ADR-001-multi-tenant-architecture-and-data-isolation.md)** | Multi-Tenant Architecture & Data Isolation Model | `Accepted` | 2026-09-15 | Multi-Tenancy, TenantContext, Row-Level Isolation, PostgreSQL |
| **[ADR-002](ADR-002-universal-5-phase-engineering-pipeline.md)** | Universal 5-Phase Engineering Pipeline (Gentle AI + Ponytail) | `Accepted` | 2026-09-15 | SDD, YAGNI, Ponytail Pruning, Pre-commit Governance, RDD |
| **[ADR-003](ADR-003-tri-tier-rbac-and-governance.md)** | Tri-Tier RBAC: SuperAdmin, Merchant Owner, and Cashier | `Accepted` | 2026-09-15 | Security, RBAC, Scoped Permissions, JWT Claims |
| **[ADR-004](ADR-004-multi-tenant-webhook-ingestion-and-anti-replay.md)** | Multi-Tenant Webhook Ingestion & Anti-Replay Cryptographic Guard | `Accepted` | 2026-09-15 | Webhooks, Ingestion, Anti-Replay Invariants, Idempotency |
| **[ADR-005](ADR-005-multi-bank-parsing-strategy.md)** | Multi-Bank Parsing Strategy (Itaú, GNB, UENO, Familiar, Atlas, Continental) | `Accepted` | 2026-09-15 | Bank Parsers, Strategy Pattern, SIPAP, Regex Resilience |
| **[ADR-006](ADR-006-merchant-onboarding-and-subscription-billing.md)** | Merchant Onboarding, Approval Requests & $15/mo Subscription Billing | `Accepted` | 2026-09-15 | Onboarding Flow, Merchant Approval, Stripe/Local Checkout |
| **[ADR-007](ADR-007-premium-fast-pos-design-system.md)** | Premium Fast-POS UX/UI Design System & High-Velocity Operation | `Accepted` | 2026-09-15 | Frontend Architecture, React, Tailwind, Web Audio Chimes, Kiosk UI |
| **[ADR-008](ADR-008-multi-tenant-memberships-and-tenant-switching.md)** | Multi-Tenant Organization Memberships & Tenant Switching | `Accepted` | 2026-09-16 | Auth, Memberships, Multi-Store, Organization Switcher, JWT |

---

## Guidelines for Authors
- When introducing or altering architectural invariants, create a new sequential ADR.
- Never edit past accepted ADRs in place; create a superseding ADR if a design changes.
