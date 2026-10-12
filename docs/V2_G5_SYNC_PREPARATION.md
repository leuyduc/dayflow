# DayFlow V2 — G5 sync preparation (DESIGN ONLY)

Date: 2026-10-12 (Asia/Bangkok)
Status: **PREPARATION, NO G5 CODE OR GATE ACCEPTANCE**
Base branch: `feat/g4-task-crud`; production G1 security blockers unchanged.

## Important facts from inspected repository
- PostgreSQL is the single authority, task rows already include immutable `user_id`, monotonically increasing `revision`, timestamps and `deleted_at` tombstones.
- G4 `PATCH` / `DELETE` uses `WHERE user_id AND id AND revision`, returning 409 on stale versions; authenticated session, Origin and CSRF protect writes.
- G4 create/update/delete **do not emit a change log** and have no idempotency key. The schema does not yet contain a change-log table, processed-mutation table or per-owner serial cursor. Therefore **current G4 cannot claim two-device sync**.
- Browser currently fetches current tasks online and does not keep a durable offline mutation queue (G7).

## Proposed G5 implementation — needs separate approval
1. Review migrations adding `sync_state(user_id, last_cursor)`, `change_log(user_id, cursor, entity, entity_id, operation, revision, payload, created_at)`, and `processed_mutations(user_id, client_mutation_id, result, committed_at)`. Ensure owner scopes, unique indexes, sane retention policy and expiry/initial snapshot handling.
2. Allocate per-owner cursor **under transaction-scoped row lock** on `sync_state`, serialize all writers by owner until COMMIT. Never allocate PostgreSQL sequence numbers independently then infer commit order from them.
3. Refactor *every* task mutation (including G4 online CRUD and later import) through one transaction that performs ownership/revision check, task write + tombstone, cursor increase, change-log append, and idempotent mutation-result storage. A failed transaction does none of these.
4. Add protected `POST /api/sync/push` and `GET /api/sync/pull?cursor=...` and authenticated `GET /api/sync/bootstrap`. Enforce per-owner authorization; validate UUID mutation IDs, payload schemas and CSRF/Origin on push; return structured conflict rather than overwriting.
5. Client keeps two-device online refresh on login, visibility focus, reconnect and optional manual Sync Now. G5 does not promise offline durable edits; offline outbox is G7.
6. Build independent PostgreSQL 17 integration tests for two simulated browser clients, reordered/duplicate requests, dropped response+retry, simultaneous edits, stale revisions, delete/recreate, long-disconnected cursor/bootstrap, logout, second owner isolation and concurrent commit-cursor ordering.
7. Keep local React/browser/real-PostgreSQL E2E test suite passing, check CI by exact SHA, preserve `main` and Ubuntu production.

## Acceptance evidence
- Dual-client A/B read-write conflict and tombstone reconciling with no silent data loss; immutable ownership; ordered commit-safe cursor under concurrency; idempotent accepted retries return original result.
- Tests must cover failures/restarts and migrations, independent GitHub Actions PostgreSQL service PASS.
- G4 must first be formally accepted and G5 scoped authorization granted; Linux G1 blockers remain separate production deployment blockers.
