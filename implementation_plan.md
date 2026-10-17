# Implementation Plan — Gmail ingestor crash: `msg.getLabels is not a function`

Status: **DRAFT — Phase 1 complete, awaiting Phase 2 human approval**
Date: 2026-10-16
Scope: the production Google Apps Script ingestor (both checked-in copies), its shared Gmail sandbox, and the two specs that pin it.
Previous plan (units A–D merged): `docs/plans/2026-10-14-backlog-code-completion.md`.

## 1. Context & root-cause analysis

Production report: `TypeError: msg.getLabels is not a function at procesarTransferenciasBancarias (Código:80:29)`.

Root cause is an API contract error, not a logic bug:

- `GmailMessage` has **no** `getLabels()` and **no** `addLabel()`. Verified against the official `GmailMessage` reference: the class exposes `getThread()`, `getId()`, `markRead()`, `isUnread()`, `star()`/`isStarred()`, but zero label methods.
- Labels are message-scoped in Gmail and are only reachable through `GmailThread.getLabels()/addLabel()/removeLabel()`. Google's own label guide states it plainly: *"Labels only exist on messages… When you add a label on a thread, you add the specified label on all **existing** messages in the thread. New messages don't inherit the existing label."*
- Both broken call sites are in the shipped script: `msg.getLabels()` (`code.gs:79`, generated copy `personalized-gas-script.ts:99`) runs **outside** the `try` block, so the first message aborts the whole run — nothing is forwarded, nothing is labeled, nothing is marked read.
- `msg.addLabel(label)` (`code.gs:124`, `personalized-gas-script.ts:144`) is the second latent crash: it would throw on the first 2xx response even after the first error is fixed.

Why the test suite stayed green: `test/unit/helpers/gas-gmail-sandbox.ts` emulates a Gmail that does not exist — `makeMessage` fabricates `getLabels()`/`addLabel()` (lines 76–81) and the specs pin that fantasy API (`expect(script).toContain('msg.getLabels()')`). The mocks encode the bug instead of catching it.

Blast radius: the ingestor has been dead since TASK-02 shipped, so every bank notification in that window is unprocessed. Because the crash happens before `markRead()`, the backlog is still unread/unlabeled and will be picked up by the first run after the fix. No backend, webhook, or claim path is affected.

## 2. Multi-tenant isolation impact

- None. No server, schema, auth, webhook, or anti-replay code changes; the fix is confined to the merchant-side Apps Script that POSTs to the existing tenant webhook.
- The new state lives in the merchant's own Script Properties (same store already holding `WEBHOOK_SECRET`) and contains only opaque Gmail message IDs — no PII, no secrets, no cross-tenant data.
- The webhook stays idempotent (`already_exists` → 200, proven in `webhook-ingest.spec.ts`), so any duplicate POST after a property reset or cap eviction is absorbed.

## 3. Design options (Phase 2 choice)

The requirement the previous change was chasing (TASK-02) is per-message dedup: a successful message must never be reposted, a failed sibling must stay eligible, and a later message in an already-processed conversation must still be processed. Gmail cannot express that with labels alone from `GmailApp`.

| | Option | Marker | Exact? | Merchant friction | Risk |
|---|---|---|---|---|---|
| **C (recommended)** | Per-message processed-ID set in Script Properties + keep `-label:` thread prune | Script Property `PROCESSED_MSG_IDS` | Yes | None (property is created automatically) | State reset → duplicate POSTs, absorbed by idempotent webhook |
| A | Star each processed message, prune with `-is:starred` | `msg.star()` / `msg.isStarred()` | Yes, unless the merchant already stars/filters bank mail | None | A merchant's existing star or Gmail filter silently suppresses a notification |
| B | Advanced Gmail service (`Gmail.Users.messages.modify`) | Real per-message label | Yes | Merchants must enable the advanced service and re-authorize | Setup step for non-technical kiosk owners; biggest diff |

**Recommendation: C.** It is the only option with no user-collision and no setup step, and its failure mode is duplicates (safe), never a lost transfer. Option A is the shortest diff; Option B is the "truest" Gmail model but pushes an editor step onto every merchant.

## 4. File-by-file changes (Option C)

- [MODIFY] `google-apps-script/code.gs`
  - Read `PROCESSED_MSG_IDS` from Script Properties (JSON array; corrupt/missing → empty array → re-send, safe).
  - Replace the `msg.getLabels()` block (lines 76–89) with `if (processed.indexOf(msg.getId()) !== -1) continue;`.
  - On 2xx: replace `msg.addLabel(label)` (line 124) with `processed.push(msg.getId())`; keep `msg.markRead()`.
  - Track per-thread `allSent`; after the message loop call `thread.addLabel(label)` only when every message in the thread is processed — that restores the `-label:` scan prune (and self-heals threads whose label step previously failed).
  - Persist once per run, only when changed: `JSON.stringify(processed.slice(-CAP))` (FIFO cap ~200 with a `ponytail:` comment naming the ceiling and the idempotent upgrade path).
  - Query text unchanged (`-label:SIPAP_Validador`), fail-closed secret handling unchanged.
- [MODIFY] `client/src/portals/owner/personalized-gas-script.ts` — identical body change in the generated copy (header already mandates keeping the two in sync).
- [MODIFY] `test/unit/helpers/gas-gmail-sandbox.ts` — add `setProperty` to the `getScriptProperties()` mock, persisting into the same `scriptProperties` object so a second `run()` observes it; expose `processedIds` for assertions. Keep the message-level label emulation: it is correct for `thread.addLabel` + `-label:` search.
- [MODIFY] `test/unit/personalized-gas-script.spec.ts`
  - Rewrite the "stays in sync… on message-level labeling" pin (lines 145–155): assert `msg.getLabels`/`msg.addLabel` are **absent** (the API does not exist), `thread.addLabel(` and `PROCESSED_MSG_IDS` are present.
  - Flip the partial-failure assertions (lines 162–199): `message-1` is recorded in the processed set and the thread stays unlabeled (previously: `isLabeled('message-1') === true`).
  - Keep the 401/500 "no label, no markRead" cases, the query pins, and the fail-closed/secret cases unchanged.
- [MODIFY] `test/unit/google-apps-script-ingestor.spec.ts` — header comment (sandbox contract) + add one regression case: a message that is already **read** but not in the processed set is still sent (guards the post-outage backlog and the "merchant read the mail first" path).
- [MODIFY] `google-apps-script/README.md` — one line documenting that the script owns a second Script Property (`PROCESSED_MSG_IDS`, auto-created; deleting it only causes safe re-sends).

### Explicitly rejected (Ponytail ladder)

- No advanced Gmail service, no new dependency, no extra trigger, no change to the search keywords or the 15-thread bound.
- No read-state marker (`isUnread()`): it silently drops any notification the merchant opened before the trigger fired — unacceptable on a payment-validation path.
- No backend change: idempotency already exists.

## 5. Decisions required in Phase 2 (not assumed)

1. **Option C vs A vs B** — C as recommended, A if you want the shortest diff and accept the star-collision ceiling?
2. **Archive of the previous plan** — already moved to `docs/plans/2026-10-14-backlog-code-completion.md` with its ODD reference updated. Restore it to `implementation_plan.md` if you prefer that file untouched?
3. **Backlog re-scan** — messages labeled by the pre-TASK-02 version are unstarred and out of the processed set, so the first run will re-POST them (server answers `already_exists` → 200). Accept the one-time burst, or filter it?

## 6. Automated verification plan (Phase 4)

- Focused: `npm test -- --runInBand --runTestsByPath test/unit/google-apps-script-ingestor.spec.ts test/unit/personalized-gas-script.spec.ts`
- Full: `npm test -- --runInBand` (all suites green, no regressions).
- `npx tsc --noEmit` — 0 errors, no `any`.
- `npm run build` — exit 0.
- No E2E claims (this repo has no E2E harness — ADR-009).
- Operator step after merge: re-paste `google-apps-script/code.gs` into the Apps Script editor; the fix does not reach Gmail until that happens. Merchants pick it up from the owner dashboard's "Copiar Mi Script Personalizado".

## 7. Out of scope

- Backend, webhook ingestion, claim/anti-replay, auth, schema, deploy/CD.
- The stale `.atl/skill-registry.md` claim that `implementation_plan.md` does not exist.
- Any change to trigger cadence, search keywords, or the 15-thread bound.
