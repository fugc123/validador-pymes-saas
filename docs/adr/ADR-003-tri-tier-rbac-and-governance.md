# ADR-003: Tri-Tier RBAC: SuperAdmin, Merchant Owner, and Cashier

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Product Owner, Security Lead

---

## Context and Problem Statement

The open-source edition had only two roles: `ADMIN` and `CASHIER`.
For a commercial multi-tenant SaaS platform, this dual-role model is insufficient because:
1. **The Platform Owner (SuperAdmin)** needs to manage commercial operations: review merchant signup requests, activate/suspend merchant accounts, view system-wide throughput, and manage billing.
2. **The Merchant Owner (Kiosk / Store Owner)** needs to administer their specific store: manage their own cashiers, select active bank accounts, review full financial claim audits, and manage their $15/month subscription.
3. **The Cashier (Point of Sale Operator)** must only be able to perform high-speed transfer checks and claims, with zero access to financial turnover or owner settings.

---

## Decision Outcome

**Chosen Solution: Tri-Tier Role Hierarchy with Strict Tenant Scoping.**

### 1. `SUPER_ADMIN` (Platform Operator):
- **Tenant Scope**: Global (Tenant ID = `null` or `*`).
- **Capabilities**:
  - `GET /api/v1/superadmin/merchants`: List all registered commercial tenants.
  - `POST /api/v1/superadmin/merchants/:id/approve`: Approve pending merchant onboarding requests.
  - `PUT /api/v1/superadmin/merchants/:id/status`: Suspend or reinstate merchant access.
  - `GET /api/v1/superadmin/metrics`: Global telemetry (daily volume, total claims, webhook latencies).

### 2. `MERCHANT_OWNER` (Store Owner / Dueño de Comercio):
- **Tenant Scope**: Strictly bound to their specific `tenant_id`.
- **Capabilities**:
  - `GET/POST/PUT/DELETE /api/v1/merchant/cashiers`: CRUD operations for their store's cashiers.
  - `GET/PUT /api/v1/merchant/settings`: Configure active banks (Itaú, GNB, UENO, etc.) and webhook tokens.
  - `GET /api/v1/merchant/transfers/audit`: Complete store transfer ledger (claimed, pending, cashier accountability).
  - `GET /api/v1/merchant/subscription`: View subscription billing status and manage payment method ($15/mo).

### 3. `CASHIER` (Punto de Venta / Cajero):
- **Tenant Scope**: Strictly bound to their specific `tenant_id`.
- **Capabilities**:
  - `POST /api/v1/cashier/transfers/verify`: Query pending transfers by exact amount + customer name within 45 minutes.
  - `POST /api/v1/cashier/transfers/claim`: Claim and lock transfer, triggering visual/audio validation.
  - **Invariants**: Cannot list recent unverified transfers. Cannot view store bank accounts. Cannot alter passwords.

---

## Authentication & Authorization Enforcement

1. **JWT Claims**:
   ```json
   {
     "sub": "usr_948271a",
     "email": "cajero1@kioskosanroque.com",
     "role": "CASHIER",
     "tenantId": "merch_7741bc",
     "iat": 1726435200,
     "exp": 1727040000
   }
   ```
2. **NestJS Guards**:
   - `@UseGuards(JwtAuthGuard, RolesGuard)`
   - Custom `@Roles(UserRole.SUPER_ADMIN, UserRole.MERCHANT_OWNER)` decorator applied at the controller and route level.
   - If a `CASHIER` attempts to hit an administrative route, a `403 Forbidden` is returned immediately.
   - If a `MERCHANT_OWNER` attempts to query another tenant's resource, the `TenantGuard` rejects the request.

---

## Consequences

### Positive:
- Clear separation of concerns between SaaS platform operations and individual store management.
- Principle of Least Privilege (PoLP) strictly upheld: cashiers have zero access to confidential business metrics.
