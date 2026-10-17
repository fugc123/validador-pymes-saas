# Implementation Plan — Backlog Code Completion (Issues #1–#11 minus #20)

Status: **DRAFT — Phase 1 complete, awaiting Phase 2 human approval**
Date: 2026-10-14
Scope: every open backlog issue's code gaps. Issue #20 (production log/DB verification) is explicitly OUT of scope — owned by the operator.

## 1. Context & root-cause analysis

Issues #1–#11 were filed 2026-09-16, before most of the current implementation existed. A read-only gap analysis (ADR-009 + code evidence) shows most are already built; the backlog is stale, not the code.

| Issue | Verdict | Genuinely open |
|---|---|---|
| #1 backend core | Implemented (deliberate deviations: raw `pg`, no RLS — ADR-009) | none |
| #2 memberships/RBAC/switcher | Implemented | none |
| #3 webhook ingestion + parsers | Implemented | none |
| #4 onboarding queue | Partial | reject action (S); DB transaction (M, judgment); two-stage flow vestigial |
| #5 Stripe/local gateways | Missing **by design** | none — superseded by #9 + ADR-009 (manual billing) |
| #6 Fast-POS UI | Implemented | CSV ledger export (S/M) |
| #7 E2E suite | Partial | decision: Supertest contract tests (M) vs re-scope/close |
| #8 landing + trial | Implemented | URL routing/deep links (M) |
| #9 dogfooding billing | Partial | auto `past_due` (M), RUC/phone match (M), promo amount (S), QR (S), backend gating (documented as not) |
| #10 metrics | Partial **+ correctness bug** | "today" is unfiltered (bug), JS instead of SQL aggregation, no peak hours |
| #11 branding/copy | Implemented | none |

Root cause of remaining gaps: (a) backlog never triaged after implementation landed, (b) `#10` shipped aggregation without date scoping, (c) `#8` intentionally deferred routing, (d) `#4`'s approval stage was superseded by self-service onboarding but never reconciled.

## 2. Multi-tenant isolation impact

- Work units A–D touch merchant-scoped queries, onboarding (unauthenticated public path), client routing, and client-side export.
- Unit A must keep `tenant_id` scoping on every new SQL aggregation; no cross-tenant aggregation for SUPER_ADMIN totals without an explicit admin query.
- Unit B must require SUPER_ADMIN role on the new reject endpoint (role guard already global).
- No schema migrations required for units A–D. No changes to auth, webhook, or claim paths.

## 3. Work units (file-by-file)

### Unit A — Issue #10 metrics correctness + SQL aggregation (M, highest value)
- [MODIFY] `src/infrastructure/repositories/in-memory.repositories.ts` — `buildMetrics`: add `created_at >= CURRENT_DATE` scoping for `totalCollectedToday`/`countValidatedToday`; add `peak_hours_distribution` (24h buckets, claimed transfers, tenant-scoped).
- [MODIFY] `src/infrastructure/repositories/in-memory.repositories.ts` — `getMetricsByTenant` (DB mode): aggregate in SQL (`SUM`/`COUNT` + date filter + hour bucketing) instead of `SELECT *`; keep in-memory path behaviorally identical.
- [MODIFY] `src/core/domain/ports/transfer.ports.ts` — `MerchantMetrics`: add `peakHoursDistribution` (+ today fields documented as calendar-day, tenant TZ = America/Asuncion constant).
- [MODIFY] `client/src/portals/owner/OwnerDashboard.tsx` — render peak-hours distribution; "Hoy" labels now truthful.
- [MODIFY] `test/unit/*.spec.ts` — new cases: today-scoped totals, all-time totals unchanged, peak-hour buckets, SQL-mode aggregation parity (DB-mode contract style like `repository-db-fail-closed.spec.ts`).

### Unit B — Issue #4 reject action (S)
- [NEW] `src/core/application/use-cases/onboarding/reject-merchant-request.use-case.ts` — flips status to `rejected` (domain method exists: `merchant-request.entity.ts:70`); SUPER_ADMIN only; idempotent on terminal states.
- [MODIFY] `src/presentation/controllers/onboarding.controller.ts` — `POST /onboarding/superadmin/merchant-requests/:id/reject` (DTO with optional reason, `class-validator`).
- [MODIFY] `client/src/portals/superadmin/SuperAdminPanel.tsx` — Rechazar button + confirm on pending rows.
- [MODIFY] `test/unit/onboarding-*.spec.ts` — reject transitions, role guard, idempotency, public path unaffected.

### Unit C — Issue #8 URL routing (M)
- [MODIFY] `client/src/App.tsx` — replace `useState<'landing'|'auth'|'register'>` with a ~30-line native history router (`pathname → view`, `popstate` listener, `pushState` navigation). No new dependency (Ponytail ladder step 3).
- [MODIFY] `client/src/portals/landing/LandingPage.tsx` — CTA/links navigate via router instead of view state.
- [MODIFY] `client/src/portals/pos/FastPosScreen.tsx` or auth guard (as needed) — `/pos` and `/login` deep links resolve to the correct portal; unauthenticated `/pos` falls back to auth.
- Verification: `npm --prefix client run build` (client has no test runner).

### Unit D — Issue #6 CSV ledger export (S/M)
- [NEW] `client/src/utils/csv-export.ts` — minimal builder (escaping, `Blob` download), stdlib only.
- [MODIFY] `client/src/portals/owner/OwnerDashboard.tsx` — "Exportar CSV" action over the already-loaded audit rows; no backend change.
- [MODIFY] `test/unit/` — unit-test the builder via root Jest (ts-jest) if resolvable from `test/`; otherwise verification = client build.

### Unit E — Triage-only closures (no code)
- Close with evidence comments: **#1, #2, #3, #11** (implemented; cite ADR-009 + files), **#5** (superseded by #9 + ADR-009 manual-billing decision).

## 4. Decisions required in Phase 2 (not assumed)

1. **Unit E closures** — close 5 issues now, or leave open pending your review?
2. **#7** — add Supertest HTTP contract tests for tenant isolation (M, unit-test-only contract stays intact), or re-scope/close as ADR-009's documented unit-only decision?
3. **#9** — which automations do you actually want: auto `past_due` job (M), RUC/phone matching (M), promo amount Gs. 120.000 (S), QR in instructions (S)? Backend subscription gating stays out (documented as-built) unless you say otherwise.
4. **#4 transactions** — add port-level transaction support for approve/submit provisioning (M), or accept current sequential-await behavior (fail-closed partial rows) per YAGNI?

## 5. Automated verification plan (per unit and at the end)

- `npm test -- --runInBand` — 27 existing suites must stay green; new cases per unit.
- `npx tsc --noEmit` — 0 errors, no `any` bypasses.
- `npm run build` and `npm --prefix client run build` — exit 0.
- No E2E claims (this repo has no E2E harness — ADR-009).
- Delivery: one PR per unit, chained smallest-first (A → B → C → D), evidence on each issue.

## 6. Out of scope

- Issue #20 and any server/log/DB access.
- Deploy/CD changes, schema migrations, auth paths, webhook ingestion, claim/anti-replay logic.
