# Feature: Add Cashier Modal and Management

## Objective
Enable merchant owners to add, view, and manage cashiers from their Owner Dashboard (`OwnerDashboard.tsx`). Clicking "+ Agregar Cajero" pops up an accessible, reactive modal to create a cashier with full name, email, and password. Cashiers and their memberships are persisted strictly in PostgreSQL (`users` and `merchant_memberships`).

## Scope
1. **Backend Repository & Ports**:
   - `auth.ports.ts`: Add `findMembersByMerchant(merchantId: string)` and `deleteMembership(id: string)` to `IMembershipRepository`.
   - `in-memory.repositories.ts`: Implement PostgreSQL queries for `findMembersByMerchant` joining `merchant_memberships` with `users` and `merchants`, plus `deleteMembership`.
2. **Backend API (MerchantController)**:
   - `GET /merchant/cashiers`: Return all members and cashiers of the active merchant.
   - `POST /merchant/cashiers`: Create a user with hashed password (if new) and assign `CASHIER` membership to the current tenant.
   - `DELETE /merchant/cashiers/:id`: Deactivate or remove cashier membership.
3. **Frontend UI (OwnerDashboard.tsx)**:
   - State for `showAddCashierModal`, `cashiersList`, `isLoadingCashiers`, and form inputs.
   - Attach `onClick` to "+ Agregar Cajero" button to open modal.
   - Modal with clean dark theme matching platform: Full name, email, password, validation, error/success banners, and loading spinner.
   - Dynamic Cashier Team table rendering real cashiers with status badge, role badge, date, and delete action.
4. **Unit Tests & Verification**:
   - Add/update tests for cashier listing and creation.
   - Verify local build (`npm run build` root and client).
   - Commit, push, and deploy to production VPS (`67.205.168.176`).

## Tasks
- [x] **TASK-01**: Add cashier querying and deletion to IMembershipRepository and implement in InMemoryMembershipRepository with PostgreSQL support.
- [x] **TASK-02**: Add GET /merchant/cashiers, POST /merchant/cashiers, and DELETE /merchant/cashiers/:id to MerchantController, register use case / services, and add unit test.
- [x] **TASK-03**: Integrate AddCashierModal and dynamic Cashier Team table in OwnerDashboard.tsx with live API calls.
- [ ] **TASK-04**: Run unit tests, build frontend and backend, commit, push to GitHub, and deploy to VPS.

## Verification Evidence
- Pending execution.
