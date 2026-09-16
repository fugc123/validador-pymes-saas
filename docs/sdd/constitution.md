# 📜 System Constitution — Validador PYME SaaS

- **Document Status**: `Ratified`
- **Effective Date**: 2026-09-16
- **Authority**: Chief Architect & Engineering Lead
- **Scope**: Entire SaaS Platform (`validador-pymes-saas`)

---

## 🏛️ Preamble

This Constitution defines the **supreme, non-negotiable architectural laws and business invariants** governing the development, deployment, and operation of *Validador PYME SaaS*. 

No feature request, performance optimization, refactoring, or third-party integration may supersede or violate the Articles set forth herein. Any pull request or proposed change that breaches an Article of this Constitution must be rejected unconditionally.

---

## Article I: The Law of Absolute Tenant Data Isolation

1. **Zero Cross-Tenant Leakage**: Under no circumstance may any database query, API response, log message, error trace, cache key, or websocket payload expose data belonging to Tenant $A$ to any user or actor scoped to Tenant $B$.
2. **Mandatory Scoping**: Every persistence operation affecting tenant-bound entities (`transfers`, `bank_accounts`, `cashiers`, `audit_logs`) MUST explicitly include `tenant_id` as an invariant filter condition.
3. **Defense in Depth**: Isolation is not trusted to frontend filters or developer discipline alone; it must be enforced cryptographically via JWT claims, structurally via NestJS interceptors, and relational-level via database constraints and query policies.

---

## Article II: The Law of Anti-Replay Voucher Invariant

1. **Single-Use Guarantee**: A bank transfer can be claimed and credited against an in-store purchase **exactly once**.
2. **Atomic State Transition**: The transition from `PENDING` to `CLAIMED` must be strictly atomic and race-condition free at the database level.
3. **Immediate Replay Alert**: If an operator attempts to verify or claim a transfer that has already transitioned to `CLAIMED`, the system MUST immediately return an `already_claimed` status with an unmaskable alert, displaying the timestamp of original redemption and the cashier responsible. Merchandises must never be released on a replayed voucher.

---

## Article III: The Law of Zero-Knowledge Retail Privacy

1. **Retail Operator Blindness**: Cashiers and point-of-sale operators are strictly isolated from the merchant's global financial reality.
2. **No Browsable Ledger for Cashiers**: Cashiers CANNOT browse, list, or search the general feed of incoming bank transfers. They can only query against an exact match of **Amount** + **Client Name** within an active 45-minute transaction window.
3. **Personal Transfer Invisibility**: Personal, non-retail transfers arriving in the business owner's bank accounts remain completely invisible to store employees.

---

## Article IV: The Law of Webhook Idempotency & Cryptographic Defense

1. **Tolerant Ingestion**: The system must treat external webhook delivery as potentially duplicate, delayed, out of order, or replayed by upstream providers (Google Cloud / Apps Script).
2. **Idempotent Ingestion Guarantee**: Processing the same bank notification email $N$ times must yield the exact same internal state as processing it once, returning `HTTP 200 { status: 'already_exists' }` without creating redundant database records.
3. **Constant-Time Verification**: All webhook secrets and signature checks MUST use constant-time comparison algorithms (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.

---

## Article V: The Law of Decoupled Global Identity & Tenant Memberships

1. **Single Human Identity**: A human user registers with one primary identity (`email` + `password_hash`).
2. **Dynamic Multi-Store Membership**: A user's authority to act within a store is derived exclusively from a distinct `merchant_memberships` association. Roles (`MERCHANT_OWNER`, `CASHIER`) belong to the membership, never to the global user entity.
3. **Explicit Context Resolution**: Every operational token emitted by the authentication system must bind to exactly one active `tenant_id`. Cross-tenant operations without explicit context switching are constitutionally forbidden.

---

## Article VI: The Law of Software Quality & Verifiable Proof

1. **Zero-Warning Discipline**: The codebase shall compile with zero TypeScript errors under strict mode (`noImplicitAny: true`, `strictNullChecks: true`).
2. **Automated Verification Contract**: No code is deemed complete without automated tests (unit and E2E) providing verifiable execution receipts.
3. **KISS & YAGNI Enforcement**: Speculative abstractions, unused parameters, dead code, and unrequested boilerplate are outlawed. Deletion of unnecessary code is preferred over addition.
