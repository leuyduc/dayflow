# DayFlow V2 — G5 online synchronization development milestone

Date: 2026-10-12 (Asia/Bangkok)
Branch: `feat/g5-online-sync`
Status: **SERVER ONLINE SYNC IMPLEMENTED AND TESTED ON WINDOWS DEV; G5 FORMAL ACCEPTANCE PENDING**

## Approved baseline
- Operator explicitly accepted G4 technical gate with commit `655d15e` and GitHub Actions run `38195148862`, without accepting unresolved G1 production security blockers.
- All G5 code is development-only. No Ubuntu production service, credential, database or `main` was changed.
- Sources of authority: `docs/V2_G5_SYNC_PREPARATION.md`, `docs/V2_SYNC_PROTOCOL.md`, V2 master plan, and GitHub checkpoints.

## Data model and commit-order safety
- Drizzle migration `0001_even_wonder_man.sql` adds 3 tables: `sync_state` (one row per owner, incrementing `last_cursor`), `change_log` (owner+cursor primary key, full change payload or deletion tombstone), and `processed_mutations` (owner+clientMutationId primary key, SHA-256 request fingerprint and cached accepted result).
- Every G4 task create/update/delete **and** G5 sync mutation now calls one common transactional writer in `apps/api/src/db/postgres-store.ts`. The transaction first creates/locks the owner's `sync_state` row with `SELECT FOR UPDATE`, then performs validated owner-scoped task write/expectedRevision compare-and-set, advances cursor, appends change record, and records an accepted client mutation result before COMMIT. A stale/unauthorized mutation produces no log or cursor increment.
- Each accepted batch operation is its own serialized transaction; a batch may contain both accepted results and per-operation conflicts. This is **not** an all-or-nothing batch guarantee.
- Replaying the same accepted `clientMutationId` with equivalent body returns its original response without writing twice. Reusing the same UUID with different body returns `idempotency-key-reused`. Patches check `expectedRevision`; losing a race returns `conflict` with owner-visible current task. Other owner's task returns `not-found`.
- Preexisting G4 tasks are visible in `GET /api/sync/bootstrap` snapshots even if created before this migration. G5 does not delete change-log history yet; retention/cursor expiry policy is deferred to scale hardening.

## API
- `POST /api/sync/push`: max 25 operations; each is `{clientMutationId, type, taskId, input | patch/expectedRevision}`. Validated with strict Zod. Owner is determined from authenticated session; requires matching Origin and `X-Dayflow-CSRF`. Response `{results:[...]} ` with explicit `ok/conflict/not-found/idempotency-key-reused` per operation.
- `GET /api/sync/bootstrap`: authenticated atomic owner snapshot `{tasks,cursor}`, row lock held for consistent snapshot.
- `GET /api/sync/pull?cursor=N&limit=100`: authenticated owner-only incremental changes, ordered `cursor`, `nextCursor`, `latestCursor`, `hasMore`; invalid future cursor 409 requesting bootstrap. The cursor is commit-ordered **per owner** (not global).
- Every task write from legacy G4 online API also emits the G5 change record. No independent backend mutation path is allowed to bypass the common writer.

## Windows development and real PostgreSQL 17 verification
- SQL migration generated and tested on isolated PGlite alongside the existing migration.
- Real PostgreSQL TCP test `npm run test:postgres:local` (extended tracked `scripts/test-g3-postgres.mjs`) passed:
  - two logged-in device A/B sessions for the same owner, consistent bootstrap and owner snapshot
  - device A create, device B pull, pagination, payload and cursor
  - retry same accepted UUID/payload returns original result; reusing UUID/different body is rejected, no extra change
  - two concurrent edits of revision 1 yield one accepted / one structured conflict; conflict returns current revision
  - four concurrent creates serialize into a contiguous per-owner committed cursor sequence
  - deletion emits tombstone to device B; bootstrap hides deleted task
  - future cursor 409, missing CSRF 403, client-supplied userId 400, cross-owner write not-found, second owner sees no foreign feed
  - G3/G4 auth/session/CRUD regressions and cleanup still PASS
- Vitest 28/28, TypeScript, ESLint, build, format PASS. Previous G4 Chrome mocked UI and full real Chrome/Vite/Fastify/PostgreSQL tests also PASS.

## G5 online client — bootstrap and incremental change feed (latest)
- On first login, the React TaskWorkspace calls `GET /api/sync/bootstrap` for a consistent owner-specific task snapshot and cursor. After online writes, it obtains a fresh atomic snapshot.
- On focus, tab visibility, network reconnect, manual **Đồng bộ ngay** and a 30-second visible-tab interval, the client reads `GET /api/sync/pull?cursor=N&limit=100` and applies ordered create/update/delete changes to the list. Tombstones remove only the matching record. Multiple pages are followed in order; a stalled cursor is rejected. An HTTP 409 cursor-ahead response triggers fresh bootstrap.
- Pull failures never wipe the existing list or advance the cursor; an in-flight pull older than a bootstrap cannot overwrite the newer snapshot. The client does not persist tokens/cursors in localStorage and does NOT claim reliable offline edits; durable outbox is G7.
- Task edits use versioned `POST /api/sync/push` with explicit conflict review. Create/complete/reopen/delete still use legacy owner-protected REST writes backed by the same transactional G5 change log.

## Checks, CI and unresolved scope
- Exact commit SHA and independent GitHub Actions run must be verified after pushing, especially the existing Postgres 17 integration job (now exercising G5).
- Full real two-browser simultaneous edit conflict E2E, conflict choices for non-edit actions, retention-based cursor expiry policy and load testing remain. React edit conflict choices and delta-pull/409-bootstrap behavior now have component tests.
- **G5 formal acceptance remains pending**, with G1-A exposed old root key and G1-C unproven Muse/Linux isolation remaining critical deployment blockers.

## Follow-up: online edit conflict review in React (2026-10-12)

- G5 task EDIT now uses authenticated `POST /api/sync/push` with a client-generated UUID mutation ID, expected revision and the existing CSRF header. Creation, completion/reopen and deletion still use legacy G4 REST routes, whose writes already feed the same transactional sync log.
- When another device has already committed a newer revision, the client receives `kind: conflict` and keeps the unsaved edit form intact. It shows the current server version and requires an explicit human choice: **Giữ bản trên máy chủ** (discard this editing form) or **Ghi đè bằng bản của tôi** (new mutation ID with the displayed server revision). If that revision races again, the conflict is shown again rather than overwriting silently.
- Missing/deleted tasks are surfaced without dropping the unsaved form. Ambiguous network failures are not automatically resubmitted; G7 will add a durable outbox for reliable replay.
- Added React component tests for both user conflict choices, revision numbers and distinct mutation IDs. Updated mocked Chrome smoke and actual Chrome/Fastify/PostgreSQL E2E harness to register the G5 sync routes.
- Local validation: TypeScript PASS; ESLint PASS; Vitest 30/30 PASS; build PASS; Prettier PASS; full real Chrome→Fastify→PostgreSQL persistence/reload/edit/complete/delete/logout regression PASS. A first real-browser test failed because its test app omitted the G5 sync route registration; the harness was corrected and independently rerun successfully. `npm run test:postgres:local` result and remote CI must be verified against the final commit.
- **Remaining for complete G5:** broader conflict controls for status/delete and independent two-browser conflict E2E. G7 offline queue is out of scope. G5 Gate acceptance and G1 production security remain pending.
