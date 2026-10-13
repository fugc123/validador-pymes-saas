# Feature: Received Transfer Capture and Cashier Disambiguation

## Objective
Capture only bank transfers positively identified as received, avoid missing eligible transfer emails, and let cashiers select the correct received transfer using amount and all safe structured transfer details available from the email.

## Problem and Why
The user reports that no recent transfers from several banks appear in the web app. The Gmail query omits common variants; parser/entity flow does not distinguish incoming from outgoing movements; and cashier search currently requires a payer identifier and shows only the first matching transfer. The owner may also need the extracted details to identify receipts.

## Authorized Scope and Constraints
- Repository: `validador-pymes-saas`, feature branch `feat/received-transfer-processing`; local implementation only.
- No access to deployed Apps Script, Gmail, production DB/VPS, GitHub, or remote services without explicit authorization naming destination, operation, and credential/session. Task #20 is blocked pending that authorization or sanitized user-provided logs.
- Only positively identified **received** transfers may be persisted as cashier-eligible transfers. Sent and direction-unknown transfer emails are discarded as transfer records and acknowledged so Gmail does not retry them indefinitely.
- Preserve tenant scope, exact amount, pending-only eligibility, 45-minute verification/claim window, atomic one-time claim, and `(tenant_id, operation_id)` ingestion idempotency.
- Keep `google-apps-script/code.gs` and `client/src/portals/owner/personalized-gas-script.ts` behaviorally synchronized. Repo edits do not update deployed Apps Script.
- Show useful structured transfer details (payer name when parsed, bank, operation/receipt reference, amount/currency, operation/ingestion time, concept when available). Do not expose raw email body, secrets, or full account numbers to cashiers.
- TDD is enabled by the project `tdd-workflow` skill; runner: `npm test -- --runInBand --runTestsByPath <spec-file>`. Client has no unit-test runner; use its build/type check.
- RDD state is unknown because native status says `on (decided by default)`, conflicting with the default-off contract. Do not start or change RDD; assess candidate and use unknown/off verification path.
- User preference: line counts are advisory only, never a reason to cancel/block a PR or force a split. Split only when it makes cohesive review units; no PR/push is authorized in this task.

## Scope / Tasks
- [ ] **TASK-01 — Production diagnosis (issue #20; remote-blocked)**: Verify deployed `BASE_API_URL`, `MERCHANT_SLUG`, `WEBHOOK_SECRET`, merchant active status, and GAS trigger using explicitly authorized target/access or sanitized user-provided logs. Do not probe production without authorization.
- [x] **TASK-02 — Broaden Gmail discovery (issue #18)**: Add plural and received-transfer search terms to the full-text Gmail query in both GAS copies; retain OR behavior, `-label:` exclusion, per-message retry safety, and bounded paging. *(Commit `3241322`; user-authorized local work unit only, no deploy.)*
- [x] **TASK-03 — Received-only direction (issue #17)**: Detect received, sent, and unknown direction using bank-specific evidence. Only positively received messages are persisted. Sent and unknown messages are acknowledged/discarded without creating a pending transfer. Never default unknown to received. *(Implemented and verified; commit `9937ece`. No DB direction column/migration required.)*
- [x] **TASK-04 — Amount-only selectable matches (issue #19)**: Require only exact amount; return all received pending matches within 45 minutes; display safe structured details in selectable cashier and owner views; claim only the selected transfer using the existing atomic path. *(Implemented and verified; commit `8d40dd8`.)*

## Acceptance Criteria
- A received email with supported transfer language is found by GAS and ingested once.
- Sent or direction-unknown transfer emails do not create pending/cashier-eligible transfers and do not retry indefinitely.
- Cashier search requires exact amount but not payer name; multiple matches are returned and can be selected.
- Cashier and owner can distinguish same-amount transfers using safe structured parsed details; raw bodies, secrets, and full account numbers remain excluded from cashier responses.
- Tenant isolation, amount exactness, pending-only search, 45-minute window, one-time atomic claim, and ingestion deduplication remain unchanged.

## Applicable Checks
- Focused Jest regression tests first; observe intended RED before production source edits.
- Full suite: `npm test -- --runInBand`.
- Root type check: `npx tsc --noEmit`.
- Backend build: `npm run build`.
- Client type/build: `npx tsc --noEmit -p client/tsconfig.json` and `npm --prefix client run build`.
- `git diff --check`; no live mailbox, deployed GAS, production, or remote tests.

## Progress and Evidence
- Read-only flow mapping completed before this tracker was created; deployed credentials, merchant status, trigger, and production logs remain unverified.
- Current verified repo facts: Gmail query is a full-text OR query but misses several plural/received phrases; `GmailApp.search(query, 0, 15)` has a 15-thread cap; parser/entity flow has no direction field; amount-only query is supported by the repository but blocked by the use case; result UI shows only the first match.
- **TASK-02 (completed; commit `3241322`)**: Added `transferencias`, `recibida`, `has recibido`, and accented/unaccented `te transfirió` variants to both query copies. `GmailApp.search` sandbox captures actual arguments; both specs verify OR terms, accent variants, label exclusion, and `(0, 15)` bound. RED: 4 failures / 24 passed / 28 total. GREEN: 28/28; full suite 27 suites / 313 tests; root/client type checks and builds exit 0; `git diff --check` exit 0. Independent verifier confirmed both copies identical and existing per-message retry / 2xx-only label behavior unchanged. No live Gmail/deployed script verification.
- Existing OpenSpec design defaulted unknown direction to received; that contradicts the user's received-only rule and is superseded by TASK-03 fail-closed acceptance above.
- User chose to discard direction-unknown emails rather than persist them for owner review.
- RDD assessment for TASK-02 returned high/unassessable because untracked paths required explicit inventory; effective RDD remained unknown/off, so no review lifecycle was started. Writer verification, parent spot-check, and independent verifier completed; no receipt/PASS was claimed.
- **TASK-03 (implemented + verified; commit `9937ece`)**: Direction detector classifies known bank/wallet received formats as `received`, explicit outgoing phrases as `sent`, and ambiguous/contradictory/unparseable messages as `unknown`; only received reaches persistence. Sent/unknown/unparseable are acknowledged with HTTP 200 and do not save/retry. RED: compile-time missing detector/output reason on the focused parser+webhook command; an intermediate lowercase `String.normalize('nfd')` caused RangeError and was corrected to `NFD`. GREEN: `npm test -- --runInBand --runTestsByPath test/unit/multi-bank-parsers.spec.ts test/unit/webhook-ingest.spec.ts` → 2 suites / 38 tests passed. Full suite: 27 suites / 326 tests; root/client type checks, backend/client builds, and `git diff --check` passed. Parent spot-check: 2 suites / 38 tests. Independent verification passed six invariants, including discard-log privacy. No direction DB migration or production/Gmail checks.
- RDD assessment for TASK-03 returned high/unassessable due untracked files; effective RDD remained unknown/off, so no review lifecycle was started. Writer verification, parent spot-check, and final independent verifier passed; no receipt/PASS was claimed.
- **TASK-04 (implemented + verified; commit `8d40dd8`)**: Amount-only requests return every tenant-scoped, exact-amount, pending received match within 45 minutes. Both cashier and owner screens render selectable matches with safe structured fields and only claim the selected transfer. Raw body/account fields remain absent. RED included compile-time missing `concept` field and DB-mode amount-only contract failures; GREEN: focused `cashier-pos.spec.ts` + `cashier-postgres-match.spec.ts` → 2 suites / 24 tests. Full suite: 27 suites / 329 tests; root/client type checks and backend/client builds exit 0; `git diff --check` exit 0. Parent spot-check: 2 suites / 24 tests. Independent verifier passed six invariants.
- RDD assessment for TASK-04 returned high/unassessable due untracked files; effective RDD remained unknown/off, so no review lifecycle was started. Writer verification, parent spot-check, and independent verifier completed; no receipt/PASS was claimed.
- Verification environment note: root and client dependencies were initially absent; the delegated writer ran `npm ci` in both workspaces to execute the requested checks, accessing package registries without prior explicit authorization. No production/Gmail/deployed Apps Script service was accessed. Do not repeat installs or remote checks without explicit authorization.
- Task breakdown follows GitHub issues #17–#20. Task #20 cannot access deployed properties or services until remote authorization is explicit.

## Next Step
TASK-02, TASK-03, and TASK-04 are committed and verified. TASK-01 production diagnosis remains blocked pending explicit remote authorization or sanitized logs from the user.
