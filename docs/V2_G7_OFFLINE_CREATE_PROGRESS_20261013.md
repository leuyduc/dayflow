# DayFlow V2 — G7 offline-create vertical slice

> Historical initial create-only checkpoint. The latest validated offline CRUD and PWA status superseding this page is in `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.

Date: 2026-10-13 (Windows local development)
Worktree: `D:\projects\dayflow` — branch `feat/g5-online-sync`, HEAD `2cae801`
Status: **PARTIAL G7 FEATURE VERIFIED**, not a complete Gate or release.
Git status: all changes remain local and uncommitted, `main` untouched.

## Implemented and usable

- Owner-scoped `Dexie` / IndexedDB cache for last authenticated task snapshot and a durable **create-only** mutation outbox.
- Quick-captured tasks are written into IndexedDB **before** the text input is cleared; they display a pending label and cannot be accidentally edited/deleted before server acknowledgment.
- Every create has a randomly generated stable `clientMutationId` and `taskId`. The existing G5 `POST /api/sync/push` contract deduplicates retries server-side. Retries reuse the exact payload and IDs, including after an accepted write whose response never arrives.
- Successful acknowledgment is checked against both client mutation ID and task ID, then the task cache update and outbox removal happen in one local IndexedDB transaction. Server sync/bootstrap reload occurs after accepted creates to avoid a transient vanished task.
- Cached tasks/pending operations are scoped by authenticated owner ID. On component restart, cached tasks and the pending queue are restored; reconnect, tab focus, manual Sync Now, and visible-tab polling attempt delivery. Failures do **not** delete pending data or advance the committed sync cursor.
- Sign-out checks the queued-work count and presents an explicit confirmation. Rejecting confirmation keeps the owner session and queue; confirming retains owner-scoped unsent operations for later login.
- Semantic server conflicts are retained in IndexedDB and surfaced as pending, rather than silently dropped.

## Verified acceptance evidence

`npm run test:browser:g6g8:postgres:local` runs disposable PostgreSQL 17 bound to `127.0.0.1:55433`, uses fixture account, real Chrome + Vite + Fastify + Drizzle, and stops PostgreSQL afterward.

| Real Chrome / PostgreSQL scenario | Result |
|---|---|
| Create task while browser offline, verify no PostgreSQL write before reconnect | PASS |
| Reconnect, verify exactly one new database task and usable UI actions | PASS |
| Simulate database commit followed by dropped response and retry same mutation | PASS, no duplicate |
| Logout with pending record requests confirmation, canceled logout preserves work | PASS |
| G6/G8 real-browser regression suite | PASS |
| Ephemeral PostgreSQL stopped cleanly | PASS |

Also: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (**17 files / 91 tests**), `npm run build`, and `git diff --check` all PASS.
Data-layer `offline-store.test.ts`: 5/5 PASS. React `TaskWorkspace.offline.test.tsx`: 2/2 PASS.

Dependency scan: `npm audit --omit=dev --audit-level=moderate` PASS with no reported production dependency vulnerabilities at check time. Full `npm audit` reports **7 development dependency advisories (5 moderate, 2 critical)**, involving Vitest/`tinypool`, `@vitest/mocker` and `drizzle-kit`'s nested old `esbuild`. The npm-suggested `audit fix --force` entails breaking tool upgrades/downgrades; it was NOT executed. Review and update deliberately before release.

## Incomplete, explicitly not claimed

- Offline editing, completion/reopen, scheduling, and deletion are still ONLINE-only. They cannot be queued offline.
- Page-shell reopening and authentication while entirely offline are NOT supported by a PWA/service worker. The cached task snapshot appears only when the app can establish an authenticated owner context.
- Semantic conflict outbox entries lack a complete recovery UI (export/duplicate/resolve); no silent deletion occurs.
- Concurrent tabs, site-storage eviction/quotas, offline logout plus different owner login, device data-loss and extended failure-injection testing require further checks.
- Browser IndexedDB data is account-keyed but NOT encrypted at rest by DayFlow; a shared/untrusted local browser profile is outside tested protection. No authentication tokens are stored in IndexedDB.
- No G7 full Gate acceptance or production readiness. G1-A/G1-C security blockers and G8 off-host encrypted database restore remain independent.

## Paths and reproducible commands

- `apps/web/src/offline-store.ts`
- `apps/web/src/TaskWorkspace.tsx`, `apps/web/src/App.tsx`
- `apps/web/src/offline-store.test.ts`, `apps/web/src/TaskWorkspace.offline.test.tsx`
- `scripts/browser-g6-g8-e2e.mjs`, `scripts/test-g6-g8-postgres-local.mjs`

```shell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser:g6g8:postgres:local
npm audit --omit=dev --audit-level=moderate
```

No commit, push, merge or production host operation was performed.

## Next implementation slice

Extend the outbox to versioned updates and delete with conflict resolution UI, while keeping idempotency, order and account boundaries. Add safe PWA/static-shell offline loading without caching private HTTP responses or tokens. Test airplane mode, browser restart/reconnect and cross-account isolation. A human must accept G7 only after real evidence for all these areas.
