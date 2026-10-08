# Feature: Reliable SIPAP Transfer Ingestion and Matching

## Objective
Ensure bank notification messages are not silently skipped, parse the reported UENO credit format, and let cashiers identify a transfer by exact amount plus payer name or SIPAP/reference when the payer name is unavailable.

## Problem and Why
The Gmail integration filters and labels conversations at thread scope even though it processes individual messages, so a successful message can hide a failed or later message in the same thread. The UENO parser does not cover the supplied alternate field labels, and cashier verification has no reference fallback when a payer name is absent.

## Authorized Scope and Constraints
- Repository: `/home/fugc/proyectos/validador-pymes-saas`, current branch `fix/pymes-saas-security`; local implementation only.
- No access to Gmail, deployed Apps Script, production, VPS, GitHub, or remote services. Do not retain or reproduce personal/account data from the user's example; tests use synthetic values only.
- Preserve tenant scoping, transfer-operation idempotency, exact amount checks, anti-replay claiming, and existing webhook-secret handling.
- Update both generic and dashboard-generated Apps Script sources together; repository edits do not update the separately deployed script.
- TDD: enabled by the repository's test-first workflow; runner `npm test -- --runInBand --runTestsByPath <spec-file>`.
- RDD: unknown because native status reported `on (decided by default)`, conflicting with the governing default-off contract. Do not start or change RDD state; use the unknown/off verification path and assess the candidate after the writer returns.
- Delivery strategy: `ask-on-risk`; current estimate is below 400 authored changed lines. Re-evaluate before any commit if the running total crosses the budget.

## Scope / Tasks
- [x] **TASK-01**: Add synthetic regression coverage for the alternate UENO receipt labels and parse amount, payer when present, and SIPAP/operation reference without inventing a payer.
- [ ] **TASK-02**: Fix thread-level Gmail filtering/labeling so one successful message cannot suppress failed or later messages in that conversation; keep generic and personalized scripts in sync and preserve safe retries.
- [ ] **TASK-03**: Support cashier verification by exact amount plus payer name, or exact SIPAP/operation reference when a payer name is unavailable; clarify the existing cashier input without weakening anti-replay or tenant boundaries.

## Acceptance Criteria
- The synthetic UENO format yields the correct positive amount and operation reference, and a payer only when a sender name is actually present.
- A failed or later message in a Gmail conversation remains eligible for processing after a sibling message succeeds; retries do not silently skip messages or compromise backend idempotency.
- Cashier lookup still requires an exact amount and a name match when supplied; when no payer name is available, an exact operation-reference match can locate the transfer.
- Existing transfer deduplication, tenant isolation, and one-time claim behavior remain unchanged.
- Generic and owner-dashboard Apps Script outputs remain behaviorally synchronized.

## Applicable Checks
- Focused regression tests first, using `npm test -- --runInBand --runTestsByPath <spec-file>`.
- Full suite: `npm test -- --runInBand`.
- Type check: `npx tsc --noEmit`.
- Backend build: `npm run build`.
- Client build: `npm --prefix client run build`.
- `git diff --check`; no live mailbox, deployed script, or production checks.

## Progress and Evidence
- Initial repository state: clean on `fix/pymes-saas-security`; no existing task document for this feature.
- Read-only root-cause mapping was completed before authorization to implement. Runtime cause is not verified against Gmail; implementation targets the proven source-level skip and matching gaps.
- Work-unit commit identities and focused verification results are recorded per task below as each task closes.
- The deployed Apps Script remains a separate manual update after repository changes.
- **TASK-01 (closed)**: RED on `npm test -- --runInBand --runTestsByPath test/unit/multi-bank-parsers.spec.ts` (3 failed: UENO parser returned `null` for alternate labels; factory invented payer `TU CUENTA ACREDITÓ UNA TRANSFERENCIA.` from the `Estimado cliente:` salutation). GREEN after extending `UenoBankParser` (Importe/Referencia SIPAP/Cliente pagador labels) and line-anchoring the universal parser's bare `cliente|usuario` payer label: 18/18 passed. `test/unit/webhook-ingest.spec.ts` 7/7 passed (dedup/idempotency unchanged).

## Next Step
Implement TASK-01 through TASK-03 one work unit at a time; update this document and its Engram mirror after each task with observed test evidence and commit identity.
