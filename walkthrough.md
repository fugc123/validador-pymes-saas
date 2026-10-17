# Walkthrough — Gmail ingestor fix (`msg.getLabels is not a function`)

Date: 2026-10-16 · Pipeline: 5-phase (ADR-002) · Spec: `implementation_plan.md`
Scope: merchant-side Google Apps Script ingestor and its test contract. No backend,
webhook, auth, or schema changes.

## 1. Symptom and root cause

Production report: `TypeError: msg.getLabels is not a function at
procesarTransferenciasBancarias (Código:80:29)`.

`GmailMessage` has **no** label API — verified against the official class reference
(methods: `getThread`, `getId`, `markRead`, `isUnread`, `star`/`isStarred`, …). Labels
exist on messages in Gmail and are reachable only via `GmailThread`, where
`thread.addLabel` labels only the messages present at that moment.

Two broken call sites per copy:

| File | Line | Problem |
|---|---|---|
| `google-apps-script/code.gs` | 79 | `msg.getLabels()` outside the `try` → aborted every run on the first message |
| `google-apps-script/code.gs` | 124 | `msg.addLabel(label)` → would throw on the first 2xx |
| `client/src/portals/owner/personalized-gas-script.ts` | 99 / 144 | identical, this is what merchants paste |

Why it went unnoticed: `test/unit/helpers/gas-gmail-sandbox.ts` fabricated
`msg.getLabels()`/`msg.addLabel()`, and the spec asserted their presence. The mocks
encoded the bug.

## 2. Design (approved in Phase 2, Option C)

- `PROCESSED_MSG_IDS` Script Property = exact per-message registry of forwarded IDs
  (FIFO cap 200, `ponytail:` comment names the ceiling and its idempotent cost).
- `SIPAP_Validador` label demoted to search prune: applied only when a thread has no
  pending message, so partial failures stay discoverable via `-label:`.
- Read state never used as a marker (a merchant-opened email must still be forwarded).

Rejected alternatives and their ceilings are recorded in
`docs/adr/ADR-010-gmail-message-dedup-in-script-properties.md`.

## 3. Changes

- [MODIFY] `google-apps-script/code.gs` — registry load/persist, membership check
  replacing the label block, `threadComplete` flag + `thread.addLabel` at thread end.
- [MODIFY] `client/src/portals/owner/personalized-gas-script.ts` — same body (the
  generated copy is now compared against `code.gs` by a test).
- [MODIFY] `test/unit/helpers/gas-gmail-sandbox.ts` — `GmailMessage` mock no longer
  exposes any label method (calls throw, as in production); added `setProperty`
  persistence, `processedIds()`, `markRead(id)`; `thread.addLabel` emulates
  threads.modify on existing messages.
- [MODIFY] `test/unit/personalized-gas-script.spec.ts` — pins inverted (assert the
  message label API is **absent**), partial-failure assertions moved to the registry,
  new body-sync test, new read-state regression test (in the ingestor spec).
- [MODIFY] `test/unit/google-apps-script-ingestor.spec.ts` — contract comment +
  registry assertions + "already-read message is still sent" regression case.
- [MODIFY] `google-apps-script/README.md` — documents the `PROCESSED_MSG_IDS`
  property and the cost of deleting it.
- [MODIFY] `client/src/portals/owner/OwnerDashboard.tsx` — removed `disabled={!activeWebhookSecret}` that permanently bricked the `2. Copiar Secreto WEBHOOK_SECRET` button whenever the initial prefetch failed; retries `requestWebhookSecret(token)` on click, surfaces session-expiry (`401`/`403`) errors instead of swallowing them, adds a synchronous `document.execCommand('copy')` fallback, and renders the secret in a `select-all` `<code>` block so clipboard restrictions never block the owner.
- [MODIFY] `test/unit/client-webhook-secret.spec.ts` — contract pin for the `OwnerDashboard` copy button.
- [NEW] `docs/adr/ADR-010-gmail-message-dedup-in-script-properties.md`.
- [MOVE] `implementation_plan.md` → `docs/plans/2026-10-14-backlog-code-completion.md`
  (previous change's spec, reference updated in `odd/tasks/backlog-code-completion.md`).

## 4. Verification evidence (Phase 4)

| Gate | Command | Result |
|---|---|---|
| Focused suites | `npm test -- --runInBand --runTestsByPath test/unit/google-apps-script-ingestor.spec.ts test/unit/personalized-gas-script.spec.ts test/unit/client-webhook-secret.spec.ts` | 3 suites / **38 tests passed** |
| Full unit suite | `npm test -- --runInBand` | **27 suites / 332 tests passed** |
| Static typing | `npx tsc --noEmit` | exit **0**, no errors |
| Backend build | `npm run build` | exit **0** |
| Client build | `npm --prefix client run build` | exit **0** (1482 modules) |

No E2E claims: this repository has no E2E harness (ADR-009).

Behavioral coverage now in the suite: fail-closed without `WEBHOOK_SECRET`; secret only
from Script Properties; 2xx registers + marks read + labels the finished thread; 401/500
registers nothing and leaves the thread eligible; a failed sibling stays eligible while
the successful message is never re-posted; a later message in a processed conversation
is forwarded without re-posting older ones; an already-read message is still forwarded;
the discovery query keeps its keywords, `-label:` prune and 15-thread bound; the
generated body matches `code.gs`.

## 5. Delivery / operator steps

1. Review and merge (no commit was made in this session; `git commit` requires approval).
2. **Re-paste `google-apps-script/code.gs` into the Apps Script editor** — the fix does
   not reach Gmail until that happens.
3. Merchants pick up the generated copy from the owner dashboard button
   *1. Copiar Mi Script Personalizado* and paste it over the old code.
4. Expect a one-time re-scan burst: messages labeled by the pre-TASK-02 version are not
   in the registry, so the first runs re-POST them; the server answers
   `already_exists` (200) and nothing is duplicated.

## 6. Out of scope

Backend/webhook/claim logic, trigger cadence, search keywords, deploy/CD, and the stale
`.atl/skill-registry.md` note claiming `implementation_plan.md` does not exist.
