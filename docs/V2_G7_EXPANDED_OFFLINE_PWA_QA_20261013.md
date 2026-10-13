# DayFlow V2 — G7 extended offline and PWA verification

Date: 2026-10-13 | Windows development worktree: `D:\projects\dayflow`
Branch/HEAD: `feat/g5-online-sync` / `2cae801`
Status: **implemented and locally tested for the scenarios below; Gate G7 NOT yet formally accepted**.
All code/evidence uncommitted. No Linux host, production DB or production deploy was touched.

## Scope of verified behavior

- Account-scoped IndexedDB/Dexie snapshots and durable create/update/delete mutation queues; each new operation has an immutable client mutation ID and uses the existing G5 idempotent `/api/sync/push` backend.
- Real offline create/edit/complete/delete retained locally, then replayed on reconnect. **Online quick complete/reopen/delete and full edit form also persist to Dexie before HTTP**, so dropped responses after COMMIT replay the same mutation key. Tests cover unmount/remount, lost acknowledgments for create/status/delete/full edit, and explicit conflict resolution without silent overwrite.
- Logout safeguards for unsynchronized work; stored records are scoped to the authenticated owner. Changes made during server conflict review are preserved when the user explicitly chooses overwrite using a **new** versioned mutation key. The server-version choice discards the owner-scoped rejected mutation. No session credentials are cached in IndexedDB.
- PWA production *static shell* (index HTML, hashed JavaScript/CSS, manifest, icon) is precached by `apps/web/public/sw.js`. Service worker does **not** intercept/cache `/api/*`, private records or credentials. The SW uses `Cache.match(..., {ignoreVary:true})` for immutable hashed bundles to handle different install-time vs module-request headers without offline bundle failure.
- Static shell can navigate and reload with Chrome offline after an online install. The UI truthfully reports inability to reach the API; an offline cold reload cannot authenticate the owner or reveal private cached work without reauthentication.

## Reproducible commands

From `D:\projects\dayflow`:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser:g6g8:postgres:local
npm run test:browser:g7:postgres:local
npm run test:browser:g7:pwa:local
git diff --check
npm audit --omit=dev --audit-level=moderate
```

The PostgreSQL scripts create their own disposable localhost-only PostgreSQL 17 test DB and stop it after the run. The current PWA command runs a Vite production preview on loopback `127.0.0.1:5178`, uses a new Chrome context and checks actual browser offline mode; screenshots and diagnostic assets under `.artifacts/` are ignored by Git.

## Observed results

| Evidence | Observed result |
|---|---|
| Whole-project Prettier, ESLint, strict TS, production build | PASS |
| Unit tests | **17 files, 103/103 PASS** (latest full run) |
| G6/G8 existing Chrome→Fastify→disposable PostgreSQL regression | PASS; DB stopped |
| G7 Chrome offline create/edit/complete/delete queued | PASS |
| G7 offline workspace remount | PASS |
| G7 reconnection with CRUD replay and conflict preservation | PASS |
| G7 explicit conflict resolution persisted to PostgreSQL | PASS |
| G7 dropped-response same-key replay | PASS, no duplicate |
| G7 two-tab concurrent replay | PASS, no duplicate/lost writes |
| G7 old-owner replay under new-owner cookie | PASS, HTTP 403 owner-session-mismatch for push/bootstrap/pull; no cross-owner writes |
| G7 stale tab private UI after cookie switch | PASS, old owner workspace unmounted on focus |
| G7 online complete/delete response lost | PASS, stable mutation key, no duplicate writes |
| G7 online full-form edit response lost after COMMIT | PASS, same immutable mutation key; revision incremented exactly once |
| G7 full-form edit conflict review | PASS, revised draft retained; explicit new-revision override or owner-scoped discard |
| G7 disposable PostgreSQL shutdown | PASS |
| PWA cache contains only approved static resources, never API | PASS |
| PWA offline navigation, offline reload and no fatal JS error | PASS |
| Production-only npm audit (moderate+) | PASS |
| Tracked `git diff --check` | PASS |

Specific process markers in Chrome tests:
```text
G7_CHROME_OFFLINE_CREATE_EDIT_COMPLETE_DELETE_QUEUED=PASS
G7_CHROME_OFFLINE_WORKSPACE_REMOUNT=PASS
G7_CHROME_RECONNECT_CRUD_AND_CONFLICT_PRESERVED_POSTGRES=PASS
G7_CHROME_EXPLICIT_CONFLICT_RESOLUTION_POSTGRES=PASS
G7_CHROME_DROPPED_RESPONSE_REPLAY_IDEMPOTENT_POSTGRES=PASS
G7_TWO_TAB_CONCURRENT_REPLAY_NO_LOST_OR_DUPLICATE_WRITES=PASS
G7_OWNER_BOUND_OUTBOX_REPLAY_REJECTED_AFTER_ACCOUNT_SWITCH=PASS
G7_STALE_TAB_PRIVATE_VIEW_HIDDEN_AFTER_ACCOUNT_SWITCH=PASS
G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_EPHEMERAL_POSTGRES_BROWSER_RESULT=PASS
G7_EPHEMERAL_POSTGRES_STOPPED=PASS
G7_PWA_STATIC_SHELL_CACHED_NO_PRIVATE_API=PASS
G7_PWA_OFFLINE_RELOAD_LOGIN_GATED=PASS
G7_PWA_STATIC_ONLY_RESULT=PASS
```

## Remaining acceptance / release blockers

1. Offline cold page load has the static app shell but cannot authenticate while disconnected; design explicit secure offline reauthentication and test account/profile boundaries before showing private data.
2. Additional multi-tab race, storage quota/eviction, forced browser restart, cross-account logout/login, timezone/DST scheduling and destructive-recovery cases need coverage.
3. The `npm audit` including development dependencies reports **7 development-tool advisories (5 moderate, 2 critical)** involving Vitest/tinypool/mocker and Drizzle-kit esbuild. npm's `--force` proposed breaking tool changes and was **not** run; require deliberate dependency upgrade + QA.
4. G8's offsite encrypted PostgreSQL backup/restore drill remains outstanding. G1-A root-key revocation and G1-C developer/production isolation remain independent critical security blockers.
5. Formal operator Gate acceptance, exact-commit CI, production staging and G9 release have not occurred. Do not call this production-ready.

## Next safe action

Review the full working-tree diff and evidence; prioritize storage eviction/quota errors, cold-offline authentication design, and further failure injection. Online full edit and quick actions are already journaled before sending and verified against server-committed/lost-response cases. Decide with the operator how to handle offline authentication and encrypted at-rest local records. Seek human approval before commit/push, production secrets, Linux access, offsite database changes or release.

## Multi-owner session fencing (additional QA)
- Durable Dexie create/update/delete requests send `X-Dayflow-Owner`. TaskWorkspace also binds the expected owner when fetching `/api/sync/bootstrap` and `/api/sync/pull`. The Fastify sync authorization function enforces header vs authenticated cookie owner on both reads and writes; backwards compatibility with earlier G5 clients (no owner header) retained.
- An isolated two-owner real Chrome/PostgreSQL test switched the active cookie from owner A to owner B within the same origin and attempted owner-A-bound push, bootstrap and pull. All returned HTTP **403**; PostgreSQL confirmed zero leaked tasks to owner B. The G7 E2E exit code was 0 and ephemeral Postgres stopped. This covers stale-tab cache contamination as well as outbox replay; it does not prove offline cold-unlock security.
- Added a Dexie unit test verifying the owner header accompanies both create and update replays. Full suite now **100/100 tests** across 17 files. Production-only npm audit PASS; full dev audit still reports the previously noted advisories.

## Final 2026-10-13 G7 durability hardening and complete local QA

The latest work removed the remaining direct, non-durable online task mutation paths. **Create, quick complete/reopen/delete, and full form edit now persist a versioned owner-scoped Dexie mutation BEFORE sending it to the server**, whether navigator.onLine is true or false. All retry the original immutable UUID/payload after an ambiguous network failure. The Fastify G5 backend accepts duplicate keys idempotently. Form conflicts preserve the user's draft and blocked mutation; an explicit user overwrite creates a new UUID using the current server revision and even retains changes made while viewing the conflict. Choosing the server version discards the matched rejected local operation.

Actual complete chain (run from the D working tree):
```sh
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser:g6g8:postgres:local && npm run test:browser:g7:postgres:local && npm run test:browser:g7:pwa:local && npm audit --omit=dev --audit-level=moderate && git diff --check
```

**Result: exit code 0, all checks PASS.** Precisely **103/103 tests in 17 test files**, strict TypeScript, full formatting/lint and production build. Both real Chrome→Fastify→temporary PostgreSQL E2E suites PASS with clean PostgreSQL shutdown. The G7 suite included:
```text
G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS
G7_CHROME_RECONNECT_CRUD_AND_CONFLICT_PRESERVED_POSTGRES=PASS
G7_TWO_TAB_CONCURRENT_REPLAY_NO_LOST_OR_DUPLICATE_WRITES=PASS
G7_OWNER_BOUND_OUTBOX_REPLAY_REJECTED_AFTER_ACCOUNT_SWITCH=PASS
G7_STALE_TAB_PRIVATE_VIEW_HIDDEN_AFTER_ACCOUNT_SWITCH=PASS
G7_EPHEMERAL_POSTGRES_STOPPED=PASS
```
Real production-build static PWA offline shell also PASS:
```text
G7_PWA_STATIC_SHELL_CACHED_NO_PRIVATE_API=PASS
G7_PWA_OFFLINE_RELOAD_LOGIN_GATED=PASS
G7_PWA_STATIC_ONLY_RESULT=PASS
```

In the standalone PWA preview, intentional absence of a Fastify server caused development-proxy `ECONNREFUSED` diagnostics for `/api/health` and `/api/auth/me`; the test specifically verifies correct *unauthenticated* offline handling, no fatal JS errors or exposed private cached API responses, and completed with exit code 0. `npm audit --omit=dev --audit-level=moderate` found **zero production dependency vulnerabilities**; the seven previously observed development-only advisories were not changed.

This is **local verification only**, **not Gate G7 acceptance or release authorization**. The remaining security/product design question is an approved secure way to authenticate the owner on a cold offline restart before revealing cached private records; preserve current login gate rather than exposing plaintext. Browser storage eviction/quota failures, extended reliability review, offsite encrypted DB recovery for G8, G1-A/G1-C Linux security and any production/staging activity remain open. All local source changes are **uncommitted and unpushed** on `feat/g5-online-sync` at `2cae801`.
