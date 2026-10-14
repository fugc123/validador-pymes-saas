# ODD Feature — Backlog Code Completion (Issues #1–#11 minus #20)

Spec: `implementation_plan.md` (repo Phase 1 artifact, this session).
Delivery strategy: ask-on-risk. Work-unit commit required per task. Chain PRs smallest-first.
Line counts are advisory only, never a reason to cancel/block a PR or force a split.

## Scope / Tasks

- [ ] **TASK-01 — Metrics correctness + SQL aggregation (issue #10, Unit A)**: scope "today" totals to the calendar day (America/Asuncion), aggregate in SQL in DB mode with in-memory parity, add `peak_hours_distribution`, render in owner dashboard. Tests: today scoping, parity, peak-hour buckets. *(Highest value: current "hoy" numbers are all-time mislabeled.)*
- [ ] **TASK-02 — Onboarding reject action (issue #4, Unit B)**: reject use case + `POST /onboarding/superadmin/merchant-requests/:id/reject` (SUPER_ADMIN) + SuperAdminPanel button; idempotent on terminal states; role-guard tests.
- [ ] **TASK-03 — URL routing (issue #8, Unit C)**: native history router in `App.tsx` (no new dependency), deep links `/`, `/login`, `/register`, `/pos` resolve correctly, unauthenticated `/pos` falls back to auth; client build green.
- [ ] **TASK-04 — CSV ledger export (issue #6, Unit D)**: `client/src/utils/csv-export.ts` (stdlib escaping + Blob download) + Exportar CSV action in OwnerDashboard; unit-test builder from root Jest if resolvable, else build verification.
- [ ] **TASK-05 — Issue triage closures (Unit E)**: evidence comments + close #1, #2, #3, #11, #5 — ONLY after Phase 2 approval of decision 1.

## Decisions (Phase 2 gate — user)

- [ ] Decision 1: close #1/#2/#3/#11/#5 as implemented/superseded?
- [ ] Decision 2: #7 — Supertest contract tests vs re-scope/close?
- [ ] Decision 3: #9 — which automations (auto past_due, RUC/phone match, promo Gs. 120.000, QR)?
- [ ] Decision 4: #4 — transactional provisioning vs YAGNI accept?

## Rules

- Out of scope: issue #20 (server logs/DB verification), CD/deploy, schema migrations, auth, webhook ingestion, claim/anti-replay logic.
- Per-unit verification: `npm test -- --runInBand`, `npx tsc --noEmit`, `npm run build`, `npm --prefix client run build`. No E2E claims.
- Native review (RDD) is blocked upstream (Gentleman-Programming/gentle-ai#5500): no receipt available; delivery follows ordinary repo policy (PR + CI green) as already documented on PRs #22/#23.
