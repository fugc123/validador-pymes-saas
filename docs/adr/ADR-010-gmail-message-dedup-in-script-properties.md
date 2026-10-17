# ADR-010 — Per-message ingest dedup lives in Script Properties, labels only prune the search

- Status: Accepted
- Date: 2026-10-16
- Related: ADR-004 (multi-tenant webhook ingestion and anti-replay), ADR-009 (implementation verification status), ODD `transfer-ingestion-reliability.md`

## Context

The Gmail ingestor (`google-apps-script/code.gs` and its generated copy
`client/src/portals/owner/personalized-gas-script.ts`) crashed in production with
`TypeError: msg.getLabels is not a function`. `GmailMessage` exposes no label API at
all — Google's reference lists `getThread()`, `getId()`, `markRead()`, `star()`, but no
`getLabels()`/`addLabel()`. Labels are reachable only from `GmailThread`, and Gmail's
label guide states they exist on messages only: `threads.modify` labels **existing**
messages, and messages arriving later do not inherit the label.

The unit suite stayed green because `test/unit/helpers/gas-gmail-sandbox.ts`
fabricated `getLabels()`/`addLabel()` on messages — the mocks encoded the bug.

Requirement (from ODD TASK-02, unchanged): a registered message must never be
re-posted, a failed message must stay eligible for retry, and a later message in an
already-processed conversation must still be processed. Gmail labels cannot express
per-message state from `GmailApp`.

## Decision

- Per-message dedup = a `PROCESSED_MSG_IDS` Script Property (JSON array of immutable
  Gmail message IDs, FIFO cap 200), written once per run and only when changed.
- The `SIPAP_Validador` label becomes **prune only**: `thread.addLabel` runs when every
  message of the thread is registered, so `-label:` keeps the search bounded while a
  partial failure leaves the thread discoverable.
- Read state (`markRead`) stays a UX signal, never a dedup marker.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| `msg.star()` + `-is:starred` prune (shortest diff) | A merchant's own star or Gmail filter would silently suppress a bank notification — a lost transfer on a payment path. |
| Advanced Gmail service (`Gmail.Users.messages.modify`) | Real per-message labels, but every non-technical merchant must enable the service and re-authorize the script. |
| Read-state marker (`isUnread()`) | Drops any notification the merchant opened before the 1-minute trigger fired. |
| Thread-level label as the only marker | All-or-nothing per thread: a partial failure would either hide the failed sibling or re-post the successful ones forever. |

## Consequences

- Failure mode of the new state is duplicate POSTs, never data loss: the webhook
  answers `200 already_exists` (proven in `webhook-ingest.spec.ts`). Resetting or
  truncating the property costs one re-scan burst, which is idempotent.
- The property holds opaque message IDs only — no message content, no secrets — and
  sits in the same store as `WEBHOOK_SECRET`, which the README now documents so
  operators do not delete it.
- The suite now pins the real contract: the sandbox throws on `msg.getLabels()` the
  way Gmail does, and `personalized-gas-script.spec.ts` asserts the generated body is
  byte-equivalent to `code.gs` (modulo emoji/whitespace), so the two copies cannot
  drift apart again.
- Known ceiling: the FIFO cap of 200 IDs can evict an entry that later re-enters the
  search; the consequence is one duplicate request, absorbed by idempotency. Raising
  the cap or sharding the property is the upgrade path if message volume ever reaches
  that bound.
