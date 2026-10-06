# Feature: Secure Pymes SaaS Authentication and Tenant Boundaries

## Objective
Remove confirmed authentication, account-takeover, webhook, tenant-isolation, and persistence failure paths while preserving the documented merchant workflows. Correct misleading security and verification documentation.

## Problem and Why
The independent review found unsigned bearer tokens, universal password bypasses, unauthenticated identity/tenant selection, public password resets for existing accounts, guessable webhook credentials, cross-tenant membership deletion, silent database-to-memory fallback, and security controls that are claimed but absent. These can expose privileged accounts, tenant data, and financial records.

## Authorized Scope
- Repository: this project only; local source and documentation changes on branch `fix/pymes-saas-security`.
- User decisions: strict RED/GREEN/REFACTOR TDD; public onboarding using an existing email returns HTTP 409 and never changes or links that account.
- No production access, deployment, external service setup, payment-provider integration, or use of production credentials is authorized. The user explicitly authorized pushing the completed changes to `https://github.com/fugc123/validador-pymes-saas` on `main`; no PR is requested.
- Preserve subscription behavior documented as warning-only; do not block ingestion or cashier verification without a separate product decision.
- Do not add dependencies without renewed authorization for their retrieval. Existing lockfile dependencies were installed from `registry.npmjs.org` with lifecycle scripts disabled.

## Constraints and Resolved Configuration
- Effective TDD: enabled, source: explicit user choice, runner: `npm test`.
- RDD: unknown. Native status reports `effective: on, source: default`, which conflicts with the governing default-off contract; do not start a review based on this ambiguous state.
- Delivery strategy: `ask-on-risk`; forecast is approximately 800 authored changed lines (additions plus deletions, excluding generated files); user selected `stacked-to-main` for any future PR slices, then explicitly chose a direct push to `main` for this change.
- Keep changes minimal, use existing dependencies, and do not weaken tenant validation or financial idempotency.

## Scope / Tasks
- [x] **TASK-01**: Sign and expire scoped/temporary tokens, enforce token purpose, remove password bypasses, and make production secret configuration fail closed.
- [x] **TASK-02**: Verify temporary-session ownership for tenant selection/switching; reject public onboarding for existing emails with 409; prevent password changes when adding existing cashier accounts; remove frontend fake-token fallback.
- [x] **TASK-03**: Validate webhook secrets only by constant-time equality with the stored secret; provide an owner-authorized way to retrieve/use the actual secret and remove slug-derived client secrets.
- [x] **TASK-04**: Scope membership deletion to the active tenant and test cross-tenant denial.
- [ ] **TASK-05**: Remove silent database-mode memory fallbacks and swallowed persistence errors; fail startup/requests safely when configured persistence is unavailable.
- [ ] **TASK-06**: Add the smallest production-suitable security headers and abuse throttling supported by the existing deployment; remove unsafe production secret defaults.
- [ ] **TASK-07**: Align docs and scripts with actual implementation, remove or repair the nonexistent E2E command, and record final checks and remaining operational limits.

## Acceptance Criteria
- Forged, expired, malformed, or wrong-purpose tokens cannot authenticate or authorize requests.
- No universal password string authenticates arbitrary accounts; public onboarding cannot alter or associate an existing account.
- Tenant selection requires a valid session belonging to the selected identity; tenant-owned mutations cannot affect another tenant.
- Webhook validation rejects all values except the stored secret; the owner workflow does not derive credentials from public tenant identifiers.
- Database errors in configured database mode are observable failures, never successful-looking in-memory writes or reads.
- Production refuses unsafe missing security configuration; rate limiting and headers are enabled without weakening input validation.
- Security regression tests exist and each task follows observed RED, GREEN, and refactor steps before completion.
- Documentation does not claim nonexistent production billing, security, test, seed, or E2E behavior.

## Applicable Checks
- Focused Jest tests added first and run with `npm test -- --runInBand --runTestsByPath <spec-file>`.
- Full backend suite: `npm test -- --runInBand`.
- Backend TypeScript/build: `npx tsc --noEmit` and `npm run build`.
- Frontend build: `npm --prefix client run build`.
- Review each tenant-sensitive and webhook path with positive and negative tests; no live production/remote checks.

## Progress and Evidence
- Baseline: repository was clean on `main`; created local branch `fix/pymes-saas-security`.
- Exploration: independent read-only map covered backend, frontend, persistence, tests, deployment, and docs; exact evidence is recorded in the session and Engram review memory.
- Dependency setup: root and client `npm ci --ignore-scripts --registry=https://registry.npmjs.org` both exited 0; no tracked files changed. Npm reported 54 root and 2 client dependency advisories; no remediation audit was authorized or performed.
- Implementation: TASK-01 through TASK-04 are complete and committed; TASK-05 code/tests are green in the working tree pending its GREEN commit; TASK-06 and TASK-07 remain open.
- Baseline verification: `npm test -- --runInBand` — 13 suites / 81 tests passed.
- TASK-01 RED checkpoints: `292205f` (15 failed / 4 passed of 19); `6ba96a7` (20 failed / 3 passed of 23 against vulnerable source); `638d04c` (3 invalid-expiry failures / 22 passed of 25); `27b9fa4` (2 unsafe-default failures / 26 passed of 28).
- TASK-01 GREEN: focused suite 28/28; full suite 14 suites / 109 tests; `npm run build` and `npx tsc --noEmit` exited 0.
- Local startup/auth smoke: production without JWT_SECRET exited 1; memory-mode development booted; valid login/token was accepted, wrong password and forged/temporary/tampered tokens were rejected. This was run before the final config-only hardening hunk; final full suite/build remained green afterward.
- Independent verification: final high-risk static check passed; parent full-suite spot-check also passed (14 suites / 109 tests).
- Seed check: documented admin credential does not match the current seed hash; the mismatch is recorded without retaining credentials and is assigned to TASK-07.
- Local Git author identity was configured only in this clone using the user's exact values. TASK-01 GREEN work-unit commit: `4d27f38` (`fix(auth): sign and constrain bearer tokens`); four RED checkpoints precede it.
- TASK-02 RED checkpoints: `8440e2a` (24 failed / 17 passed of 41 across four suites); `965ec7f` (repository race 6 failed / 2 passed, client helper missing-module RED).
- TASK-02 GREEN: focused repository/client/auth suites passed; full suite 16 suites / 151 tests; backend `tsc`/build and client build exited 0.
- TASK-02 independent source verification passed; parent full-suite spot-check also passed (16 suites / 151 tests). Native risk assessment was unassessable due to new files and is treated as high; no RDD review was started.
- TASK-02 GREEN work-unit commit: `6f632b7` (`fix(auth): close signup races and bind tenant sessions`).
- TASK-03 RED checkpoints: `b7a1760` (derived secrets and owner endpoint); `55b4d73` (missing tenant denial and webhook-probe failures).
- TASK-03 GREEN: focused webhook specs 24/24; full suite 18 suites / 172 tests; backend `tsc`/build and client build exited 0.
- TASK-03 independent verification passed; parent full-suite spot-check passed (18 suites / 172 tests). Risk assessment was unassessable due to untracked helper files; all new source files will be included in the GREEN commit.
- Operational note: scripts using derived secrets will receive 401 until the owner copies the updated script/secret from the dashboard; no production inventory or rotation was performed.
- TASK-03 GREEN work-unit commit: `14f7b86` (`fix(webhook): require the stored tenant secret`).
- TASK-04 RED checkpoint `a36e7cb`: cross-tenant/absent deletion failed (2 failures / 6 passes) and old one-argument port calls produced compile-time RED.
- TASK-04 GREEN: focused membership/cashier suites 28/28; full suite 18 suites / 177 tests; backend `tsc`/build and client build exited 0.
- TASK-04 independent source verification passed; parent full-suite spot-check also passed (18 suites / 177 tests). DB error fallback remains TASK-05; superadmin-without-tenant delete fails closed before repository access but may surface as 500.
- TASK-04 GREEN work-unit commit: `77b5f0a` (`fix(auth): scope membership deletion to tenant`).
- TASK-05 RED checkpoints: `616acc0` (37 failed / 17 passed of 54 persistence cases); `61439ed` (payment report remained matched after failed confirmation); `116d517` (45-minute DB claim cutoff missing).
- TASK-05 GREEN: full suite 20 suites / 220 tests; `npx tsc --noEmit`, backend build, and client build exited 0. Local boot checks: production without DB config and configured unreachable DB both exited 1; unconfigured development stayed in memory mode.
- TASK-05 independent verification passed; parent full-suite spot-check passed (20 suites / 220 tests); native assessment returned medium risk.
- Operational limit: if subscription confirmation succeeds but payment-report persistence then fails, the transfer stays claimed and credit is not repeated, but its report remains pending and may need manual reconciliation; no cross-repository transaction was introduced.
- The DB claim query now enforces the same inclusive 45-minute window as the transfer domain. Older transfers will not auto-claim for subscription reports; no production billing behavior was inspected.
- Next step: commit the verified TASK-05 GREEN work unit, then begin TASK-06 under strict TDD.

## Delivery and Commit Evidence
- Forecast: approximately 800 authored changed lines; planning heuristic only, not a hard cap.
- Chain strategy: `stacked-to-main` for any future PR slices. For this change, the user explicitly authorized a direct push to `main` after all tasks and checks; no PR is authorized or planned.
- Each completed task will be checked off only after its observed checks and recorded in this document and its Engram mirror. Commits are local Conventional Commits; the authorized push to `main` remains pending completion of all tasks and checks.
