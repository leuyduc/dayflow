# DayFlow V2 — Synchronization Contract and Safety

## Source of truth
PostgreSQL is authoritative when connected. IndexedDB is account-scoped cached data and a durable pending-operation queue. Do not silently replace server data with stale local data.

## Data fields
Each task/settings record has immutable userId and id, monotonically increasing per-record revision, updatedAt, and optional deletedAt. The sync change log uses a per-user, monotonically ordered cursor. Do NOT rely on naive DB sequence allocation without handling transactions committing out of order; use a serialized per-user writer or another proven commit-safe scheme, and test concurrent writers.

## Client operation
Every mutation has clientMutationId UUID, entity/id, operation, expectedRevision (or explicit creation), payload, and local creation time.
1. Client validates and records pending mutation locally before acknowledging offline edits.
2. When authenticated and online, POST batch to /api/sync/push with idempotency IDs.
3. Server checks auth/ownership, payload, expectedRevision and invariants inside transaction, records accepted mutation ID and change log entry atomically.
4. Duplicate mutation ID returns original result; it must not apply twice.
5. Stale expectedRevision returns structured conflict with current server value/revision, not silent last-writer-wins.
6. Client resolves conflict visibly (retain server version, reapply/edit own version after review, or save a separate task). User choice creates a fresh versioned mutation.
7. GET /api/sync/pull?cursor=... returns ordered changes and nextCursor, including tombstones. A bootstrap snapshot is used for first login or expired cursor.
8. Refresh automatically on login, online/reconnect, app focus and limited interval; manual Sync Now remains available. No WebSocket requirement in MVP.

## Delete and account boundaries
- Deletions persist as tombstones until all valid clients can catch up or an explicit cursor-expiration/resnapshot policy takes over.
- Never leak records across user IDs. Log out invalidates session and addresses cached account data, while preserving/exporting any unsent edits with explicit warning.
- Never wipe an outbox silently after authentication failure or server error.
- Transport uses HTTPS and same-origin cookie session. Do not persist bearer tokens in local browser storage.

## Phase sequence
G4: secure online API task CRUD.
G5: two-device online synchronization, revision conflicts, idempotency and tombstones.
G7: offline mutations, cache strategy, PWA, reconnect, recovery and conflict UI.
Until G7, do not claim offline editing is reliable.

## Required contract tests
Two devices A/B create/edit/delete; duplicate POST retry; dropped response after accepted mutation; racing edits; clock skew; reconnect after downtime; bootstrap and long-disconnected client; delete/recreate; logout with pending writes; unauthorized cross-account read/write; import changes reflected by sync; concurrent change log ordering; timezone differences.
