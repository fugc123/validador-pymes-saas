---
name: sipap-transfer-validation
description: Guide to understanding, developing, testing, and expanding bank transfer validation and parsers (Itaú, GNB, UENO, Familiar, Atlas, Continental) and anti-replay POS verification in CajaSegura. Use when adding bank parsers, modifying webhook ingestion, or working with transfer claiming.
metadata:
  origin: CajaSegura
---

# SIPAP Transfer Validation & Anti-Replay Architecture

CajaSegura is an anti-fraud SaaS for Paraguayan retail PYMEs. It validates bank transfers (SIPAP) in real-time to protect merchants from fake payment screenshots.

## Architecture

1. **Ingestion Layer**:
   - Google Apps Script parses incoming bank notification emails in merchant's Gmail.
   - Forwards raw notification to `POST /api/v1/webhook/:tenantSlug` with header `X-Merchant-Webhook-Secret`.
   - `BankParserFactory` automatically classifies the bank:
     - **Itaú Paraguay**: Debits and credits via SIPAP.
     - **UENO Bank**: Mobile notifications & account credits.
     - **Banco Familiar**: FAMIPYPAARES operation references.
     - **Banco GNB**: 30-digit voucher references.
     - **Banco Atlas**: ATLAPYPAARES receipts.
     - **Banco Continental**: SIPAP credit receipts.

2. **Anti-Replay & Atomic Claiming**:
   - Transfers are stored with `status: 'pending'`.
   - Cashiers verify by amount + customer name at POS (`POST /api/v1/cashier/transfers/verify`).
   - Claiming marks transfer as `claimed` with cashier ID and timestamp (`POST /api/v1/cashier/transfers/claim`).
   - A claimed transfer CANNOT be claimed again (prevents customers from using the same transfer voucher twice).

3. **Dogfooding Subscription Payment**:
   - Merchants pay Gs. 150.000/month to Alias `5644334` (Franco Girala).
   - In `OwnerDashboard`, owner reports payment (`POST /api/v1/subscription/report-payment`).
   - In `SuperAdminPanel`, admin validates against incoming transfers in `cajasegura-platform` (`POST /api/v1/subscription/validate-payment-report/:id`).
   - Matching auto-extends 30 days of active subscription.

4. **Testing Bank Parsers**:
   - Unit tests live in `test/unit/multi-bank-parsers.spec.ts`.
   - Run `npx jest test/unit/multi-bank-parsers.spec.ts` to verify parser regexes.
