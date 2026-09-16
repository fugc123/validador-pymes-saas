# ADR-004: Multi-Tenant Webhook Ingestion & Anti-Replay Cryptographic Guard

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Security Team, FinTech Operations

---

## Context and Problem Statement

In the single-tenant edition, a single webhook route `/api/webhook/email` verified a single global secret `X-Webhook-Secret`.
In a multi-tenant SaaS:
1. The platform must ingest bank notification emails from hundreds of independent merchant Gmail accounts via Google Apps Script.
2. Ingestion must correctly attribute the transfer to the corresponding merchant tenant.
3. The platform must prevent fraud: customers reusing the same transfer receipt to pay multiple times (Anti-Replay Invariant), or webhooks delivering duplicate emails due to Google retries.

---

## Decision Outcome

**Chosen Solution: Per-Tenant Dedicated Webhook Endpoints with Cryptographic Anti-Replay State Machine.**

### 1. Dedicated Webhook Route per Merchant:
- Endpoint: `POST /api/v1/webhook/:tenantSlug` (e.g. `/api/v1/webhook/kiosko-san-roque`).
- Header: `X-Merchant-Webhook-Secret: <unique_tenant_secret>`.
- The secret is generated using `crypto.randomBytes(32).toString('hex')` upon merchant approval.
- The webhook controller:
  1. Resolves `merchant` by `tenantSlug`.
  2. Verifies that the merchant's subscription is in `ACTIVE` or `TRIAL` status.
  3. Validates the provided secret in constant-time using `crypto.timingSafeEqual` to prevent timing attacks.

### 2. Ingestion Idempotency (Anti-Duplicate):
- Every parsed transfer generates a deterministic unique constraint on `(tenant_id, operation_id)`.
- If an email is re-delivered by Google Apps Script, the database detects the unique violation:
  - It does NOT duplicate the record.
  - It gracefully returns `HTTP 200 { status: 'already_exists' }`.
  - The script marks the email as processed in Gmail.

### 3. Anti-Replay Guard on POS Claims:
- A transfer entity has an internal finite state machine:
  - `PENDING`: Available for cashier verification and claim.
  - `CLAIMED`: Locked. Associated with `claimed_at` timestamp and `claimed_by_user_id`.
- The `claim()` transition is atomic in SQL:
  ```sql
  UPDATE transfers
  SET status = 'claimed', claimed_at = NOW(), claimed_by_user_id = $userId
  WHERE id = $id AND tenant_id = $tenantId AND status = 'pending';
  ```
- If rows affected == 0, another cashier already claimed it or it was previously redeemed. The API immediately alerts in **RED** (`already_claimed`) and returns the exact timestamp of prior redemption, preventing goods from being handed over.

---

## Consequences

### Positive:
- Total tenant isolation during email ingestion.
- 100% protection against fraudulent voucher reuse.
- High resilience to network retries from Google Cloud datacenters.
