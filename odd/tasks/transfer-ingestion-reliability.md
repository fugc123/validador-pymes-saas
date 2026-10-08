# Feature: Reliable SIPAP Transfer Ingestion and Matching

## Objective
Ensure bank notification messages are not silently skipped, parse the reported UENO credit format, and let cashiers identify a transfer by exact amount plus payer name or SIPAP/reference when the payer name is unavailable.

## Problem and Why
The Gmail integration filters and labels conversations at thread scope even though it processes individual messages, so a successful message can hide a failed or later message in the same thread. The UENO parser does not cover the supplied alternate field labels, and cashier verification has no reference fallback when a payer name is absent.

## Authorized Scope and Constraints
- Repository: `validador-pymes-saas`, current branch `fix/pymes-saas-security`; local implementation only.
- No access to Gmail, deployed Apps Script, production, VPS, GitHub, or remote services. Do not retain or reproduce personal/account data from the user's example; tests use synthetic values only.
- Preserve tenant scoping, transfer-operation idempotency, exact amount checks, anti-replay claiming, and existing webhook-secret handling.
- Update both generic and dashboard-generated Apps Script sources together; repository edits do not update the separately deployed script.
- TDD: enabled by the repository's test-first workflow; runner `npm test -- --runInBand --runTestsByPath <spec-file>`.
- RDD: unknown because native status reported `on (decided by default)`, conflicting with the governing default-off contract. Do not start or change RDD state; use the unknown/off verification path and assess the candidate after the writer returns.
- Delivery strategy: `ask-on-risk`; user selected `stacked-to-main` after the running count reached 571 authored changed lines. This selects a future PR-chain shape only; no PR or push is authorized. Keep commits as independent work units and record slice boundaries; re-evaluate the budget before each commit.

## Scope / Tasks
- [x] **TASK-01**: Add synthetic regression coverage for the alternate UENO receipt labels and parse amount, payer when present, and SIPAP/operation reference without inventing a payer.
- [x] **TASK-02**: Fix thread-level Gmail filtering/labeling so one successful message cannot suppress failed or later messages in that conversation; keep generic and personalized scripts in sync and preserve safe retries. *(Completed as slice 2 of the user-selected three-slice plan: slice 1 = TASK-01 commit `dc00742` (139 authored lines), slice 2 = TASK-02 commit `a974689` (562 authored lines), slice 3 = TASK-03. TASK-02 is one cohesive work unit: both GAS copies + both behavior specs + the shared Gmail sandbox helper; no PR or push.)*
- [x] **TASK-03**: Support cashier verification by exact amount plus payer name, or exact SIPAP/operation reference when a payer name is unavailable; clarify the existing cashier input without weakening anti-replay or tenant boundaries. *(Implemented and verified as slice 3, commit `fa99826`; 466 authored commit lines (415 additions / 51 deletions), including tracker documentation; implementation/tests: 455 lines. No PR or push.)*

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
- **TASK-01 (closed, commit `dc00742`)**: RED on `npm test -- --runInBand --runTestsByPath test/unit/multi-bank-parsers.spec.ts` (3 failed: UENO parser returned `null` for alternate labels; factory invented payer `TU CUENTA ACREDITÓ UNA TRANSFERENCIA.` from the `Estimado cliente:` salutation). GREEN after extending `UenoBankParser` (Importe/Referencia SIPAP/Cliente pagador labels) and line-anchoring the universal parser's bare `cliente|usuario` payer label: 18/18 passed. `test/unit/webhook-ingest.spec.ts` 7/7 passed (dedup/idempotency unchanged).
- **TASK-02 (implemented + verified; closes as slice 2, commit `a974689`)**: Gmail primitives applied per Apps Script contracts — labels live on messages, `thread.addLabel` labels every message of the conversation, and `-label:` search returns conversations still holding an unlabeled message; backend idempotency (`already_exists` → 200, proven in `webhook-ingest.spec.ts`) covers any duplicate post. RED in both GAS specs before the fix: failed sibling was labeled and never retried (2 fetches instead of 3), and a later message triggered a repost of the processed message (3 fetches instead of 2). GREEN: `npm test -- --runInBand --runTestsByPath test/unit/google-apps-script-ingestor.spec.ts` 12/12, `.../personalized-gas-script.spec.ts` 12/12. Both copies keep the `-label:` prune plus per-message skip, so fully-processed conversations are not rescanned (run 3 sends nothing). The two identical ~100-line Gmail sandbox emulations were deduplicated into `test/unit/helpers/gas-gmail-sandbox.ts` (one Gmail model for both specs; assertions unchanged) and the focused rerun was `npm test -- --runInBand --runTestsByPath test/unit/google-apps-script-ingestor.spec.ts test/unit/personalized-gas-script.spec.ts` → 2 suites / 24 tests passed. Parent spot-check repeated the focused command after resume: 2 suites / 24 tests passed.
- **SLICE PLAN (user-selected `stacked-to-main`, no PR/push authorized)**: slice 1 = TASK-01 commit `dc00742` = 139 authored lines. Slice 2 = TASK-02 commit `a974689` = **562 authored lines** (388 adds / 174 dels). Slice 3 = TASK-03 commit `fa99826` = **466 authored lines** (415 adds / 51 dels), including 11 tracker-documentation lines; implementation/tests contribute 455. Running work-unit total = **1,167 authored lines**. Slices 2 and 3 each exceed the 400-line PR budget; no PR/push is authorized, so any future PR needs one honest split or maintainer-approved `size:exception`.
- Verification battery on the staged tree (foreground, exact commands): focused specs 18/18, 12/12, 12/12; `npm test -- --runInBand` → 25 suites / 289 tests passed; `npx tsc --noEmit` → exit 0; `npm run build` → exit 0; `npm --prefix client run build` → exit 0; `git diff --check` + `git diff --cached --check` → exit 0. No E2E suite exists; no network/service tests were run.
- **TASK-03 (implemented + verified; commit `fa99826`)**: RED on `npm test -- --runInBand --runTestsByPath test/unit/cashier-pos.spec.ts test/unit/cashier-postgres-match.spec.ts` (4 failed / 17 passed / 21 total, intended empty-ID, amount-only, and DB-mode payer-word prefilter defects). GREEN on the same command: 2 suites / 21 tests passed. The use case fetches tenant + exact amount + pending candidates once, applies the 45-minute filter, tries diacritic-insensitive payer-word matching, then exact case-insensitive `operationId`/`receiptNumber`; blank identifiers return before any repository/SQL call. Both UI flows require amount and name/reference and stop blank-identifier requests/radar. `npm test -- --runInBand` → 26 suites / 303 tests passed; `npx tsc --noEmit`, `npx tsc --noEmit -p client/tsconfig.json`, `npm run build`, `npm --prefix client run build`, and `git diff --check` → exit 0. Parent spot-check: focused command 2 suites / 21 tests passed. Independent read-only verification passed all six invariants; a dedicated expiry test for reference fallback is absent, though both paths share the checked prefilter. No E2E suite exists; no live Gmail, deployed script, or production checks.

## Next Step
Feature tasks are complete and their work-unit commits are recorded. Deployed Apps Script update remains a separate manual operation; no remote action was authorized.
