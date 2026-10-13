# DayFlow V2 — Operator checkpoint

Updated: 2026-10-13
**ACTIVE LOCAL WORKTREE (Windows MCP): `D:\projects\dayflow`.** All future local reads, edits, tests and Git commands must use this directory, not the former C clone.
Working repo: `leuyduc/dayflow` (public).
Working branch: `feat/g5-online-sync` at `2cae801` (`test(g5): verify two Chrome sessions resolve edit conflicts`).
`main` was not touched. No commit and no push were made for the work below.
Active execution roadmap (updated 2026-10-13): `docs/V2_ACTIVE_MASTER_PLAN_20261013.md`. Historical design baseline: `docs/V2_MASTER_PLAN.md`. The older master has outdated NOT STARTED and Muse/OpenCode statements; use active roadmap and live STATE for actual progress.
DO NOT put credentials, private key text, internal infrastructure addresses or production data here.

The 2026-10-12 copy of this file still said G2–G9 were not started. That was already behind the commits on this branch. This snapshot replaces that summary. Older facts stay in `.chatgpt/JOURNAL.md`.

## Goal
Authenticated personal planner: React+Vite web, Fastify API, PostgreSQL authority, online sync, calendar and deterministic suggestions, settings, JSON backup. Offline outbox and production release are still open. No AI feature in the product.

## End-to-end Gate status
| Gate | Current status | Notes |
|---|---|---|
| G0 — Linux audit | AUDITED | Record stands. No new host audit on 2026-10-13 |
| G1 — SSH, identity, isolation | NOT PASSED | G1-A and G1-C remain blockers. G1-D OpenCode/Muse is retired as the coder |
| G2 — Full-stack foundation | IMPLEMENTED IN TREE | Monorepo, health, lint/type/test scripts exist. Formal gate acceptance was not re-checked on GitHub |
| G3 — Authentication + database | IMPLEMENTED IN TREE | Session, CSRF, owner scoping, Drizzle migrations. Live Postgres evidence was not re-run on 2026-10-13 |
| G4 — Task UI/API | IMPLEMENTED IN TREE | CRUD, search, filters, sort, duration, tags, subtasks, schedule edit. `START_HERE.md` records human acceptance of `655d15e`; that acceptance was not re-fetched |
| G5 — Two-device online sync | IMPLEMENTED THROUGH `2cae801` | Cursor, change log, conflicts, tombstones. CI for `2cae801` was not rechecked this session |
| G6 — Calendar + scheduling | CODED, UNCOMMITTED, LIVE E2E VERIFIED (PARTIAL SCOPE) | Real Chrome→Fastify→isolated PostgreSQL PASS for 7-day suggestion accept, unschedule, day/week/month navigation, manual placement and mobile month view without horizontal overflow. Additional failure/DST cases and human Gate acceptance remain |
| G7 — Offline queue and PWA | EXTENDED LOCAL FEATURE VERIFIED, GATE NOT ACCEPTED | Owner-scoped durable Dexie outbox for create/update/delete, including **online** status/delete and full-form edits persisted before HTTP. Real Chrome→isolated PostgreSQL PASS offline CRUD/reconnect, conflict review, two-tab replay, account-switch isolation and dropped responses after COMMIT replaying the same UUID for create/status/delete/form. Static-only PWA shell PASS; cold offline owner authentication, storage/privacy failure testing and formal Gate acceptance remain. See `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md` |
| G8 — Settings + JSON backup | CODED, UNCOMMITTED, LIVE E2E VERIFIED (PARTIAL SCOPE) | Real Chrome→Fastify→isolated PostgreSQL PASS for settings save, export of persisted values, merge import, settings-only restore + UI refresh, overlap-import transactional no-write, invalid-file rejection. Offsite encrypted database backup/restore drill remains; human Gate acceptance pending |
| G9 — Public release | NOT STARTED / BLOCKED | **Private, localhost-only Linux staging deploy and real-browser smoke PASS** on 2026-10-13; NOT public production, no DNS/TLS/system proxy, no production migration, no formal G9 acceptance. G1 security + G8 DR remain hard blockers |

## G1 substeps (unchanged blockers)
| Step | Status | Evidence or concern |
|---|---|---|
| G1-A old root-key revocation | DEFERRED / SECURITY BLOCKER | Old exposed key was still treated as authorized. Do not mark G1 passed |
| G1-B restricted developer identity | PARTIAL | Fresh 2026-10-13 SSH as `dayflow-dev` PASS, only `dayflow-dev` group observed; full negative filesystem/network isolation Gate checks still not PASS |
| G1-C development isolation | NOT PASSED | Loopback reachability was demonstrated in the 2026-10-12 audit |
| G1-D OpenCode/Muse on Linux | RETIRED | Not a coding path. OpenCode Go quota ended the previous coding session |
| G1-E admin sign-off | NOT STARTED | |

## What is in the working tree
`git status` on 2026-10-13 shows a dirty tree on top of `2cae801`. It includes schedule-overlap checks, calendar, backup, settings, Today navigation, task schedule editing, and subtasks. The latest local G8 repair corrected backup export settings, settings-only import, post-import UI refresh and the API import size limit; six targeted regression tests were added. None of this is committed.

Usable behavior covered by the unit tests:

- Task capture, edit, complete, reopen, delete, search, status filter, priority filter, sort.
- Edit duration, tags, due date, scheduled start/end, and up to 30 subtasks. Due date and scheduled block stay distinct. Overlap returns `schedule-overlap`.
- Today page: previous day, today, next day; scheduled, overdue, and unscheduled sections.
- Calendar: day, week, month; suggestion preview; accept all remaining blocks or drop one; manual place; create a task onto the day being viewed.
- Settings: timezone, working days and hours, default duration, buffer, week start, theme. Saved with `expectedRevision`.
- JSON export/import. Export validates that its own file can be parsed again and uses saved settings, not browser defaults. Older backup v1 files without `weekStartsOn`/`theme` are accepted. Invalid files do not write. Import applies schedule settings from the file even when every task ID already exists; the Settings form reloads after a successful import.

## Verification on 2026-10-13
First observed in `C:\Users\ABC\dayflow`; lint, typecheck, 84 tests and build were independently re-run successfully after relocation to `D:\projects\dayflow`:

- `npm run lint` passed on the full repo.
- `npm run typecheck` passed.
- `npm test` passed: 15 files, 84 tests (six regression tests added during G8 repair).
- `npm run build` passed, including web production bundle.
- `git diff --check` passed for tracked changes (LF/CRLF warnings are not whitespace errors).
- `npx prettier --check` passed for the G8 source/test files changed in this repair.
- `npm run format:check` PASSED on the full repo after setting Prettier `endOfLine: auto` for cross-platform Git checkout compatibility and formatting just `apps/api/src/settings/routes.test.ts`. The earlier 36 warnings were 35 line-ending-only mismatches caused by Windows `core.autocrlf=true`, plus one substantive file formatting difference. No unrelated mass-formatting.
- `git ls-remote origin refs/heads/feat/g5-online-sync` confirmed the remote feature HEAD remains `2cae801`.
- `npm run test:browser:g6g8:postgres:local` PASS on D: disposable PostgreSQL 17 bound to localhost with isolated fixture owner; tested G6 accept/unschedule, views, manual placement, mobile viewport and G8 custom settings save, export, merge, settings-only restore, overlap rollback and invalid-file no-write. Database stop/cleanup PASS. No production access or credentials involved. Evidence: `docs/V2_G6_G8_LOCAL_E2E_20261013.md`.

Not run, so not claimed:

- Offsite encrypted PostgreSQL backup/restore drill, broader failure injection and DST/timezone-change browser scenarios. The expanded local G6/G8 Chrome+PostgreSQL cases passed and do NOT replace a production recovery drill.
- GitHub CI for `2cae801` or for the dirty tree. Only the remote branch SHA was checked; no CI status claim is made.
- Any SSH, production database, firewall, or deploy command.

## Local working directory relocation — 2026-10-13
- The user designated `D:\projects\dayflow` as the active workspace. Existing clean D clone (`prompt/agent-bootstrap` at `e6387cb`) was preserved intact at `D:\projects\dayflow-legacy-bootstrap-20261013` before replacement.
- Copied the complete dirty C worktree, including `.git`, hidden/ignored files, untracked G6/G8 work and `.chatgpt` state. Robocopy: 15,352 files, approximately 237 MB, zero failures. A Robocopy metadata comparison dry run found zero missing/different files. The four npm workspace junctions were recreated pointing to D rather than C.
- Verified D Git branch `feat/g5-online-sync`, HEAD `2cae801`, origin `leuyduc/dayflow`, and the original dirty Git status. On D, `npm run lint`, `npm run typecheck`, `npm test` (84/84) and `npm run build` all PASS.
- The original `C:\Users\ABC\dayflow` remains unchanged as a fallback copy. **Never edit or sync back to C automatically**; D is now the authoritative local working tree. The legacy D clone is a separate backup. Neither backup was deleted.
- No commit, push, merge, deployment or production operation was performed for the relocation.

## Reproducible isolated live E2E harness
- `scripts/test-g6-g8-postgres-local.mjs` and npm script `test:browser:g6g8:postgres:local` run the existing `scripts/browser-g6-g8-e2e.mjs` against temporary real PostgreSQL. It creates a randomly named `dayflow_test_*` database under a localhost-only PostgreSQL sandbox and cleans up automatically. The optional package `embedded-postgres@17.10.0-beta.17` is installed only into ignored `.artifacts/postgres-sandbox/` using `--ignore-scripts`; it is not a production dependency.
- Expanded `npm run test:browser:g6g8:postgres:local` returned exit 0 with `G6_G8_BROWSER_TO_POSTGRES_RESULT=PASS` and `G6G8_EPHEMERAL_POSTGRES_STOPPED=PASS` on 2026-10-13. Real Chrome covered calendar navigation/manual place/mobile, settings export/import, transactional overlap rejection; details in `docs/V2_G6_G8_LOCAL_E2E_20261013.md`. No secrets were logged or committed.

## Mandatory context recovery before continuing any work
- Explicit operator instruction (2026-10-13): ChatGPT must always re-read D-local `.chatgpt/STATE.md` and check actual D Git branch/HEAD/dirty state, because conversation context/cache can be truncated or lost. Read relevant JOURNAL/LESSONS/specs as needed; do not treat chat memory or old GitHub as authoritative. After each independently verifiable step, persist checkpoint and journal, then READ BACK from D before starting another step.
- Never silently switch checkout to C or old GitHub. If D checkpoint/read-back fails, pause writes and report the missing evidence.

## Active execution slice (2026-10-13)
- Operator requested autonomous continuation with D-local context rechecks. G7 offline-create outbox implemented in `apps/web/src/offline-store.ts` and TaskWorkspace/App wiring; 5 Dexie + 2 React tests PASS. Real Chrome→Fastify→isolated PostgreSQL verified offline create/reconnect exactly once, dropped response after commit retry, and cancellation of logout while work pending. Full repo QA PASS: 91/91 tests (17 files), format/lint/typecheck/build/diff check. Existing G6/G8 browser cases still PASS. Evidence: `docs/V2_G7_OFFLINE_CREATE_PROGRESS_20261013.md`. NOT full offline-first/PWA; no human Gate acceptance, commit, push or production.
- Security: `npm audit --omit=dev --audit-level=moderate` PASS for production deps; full `npm audit` flagged 7 **dev** advisories (5 moderate, 2 critical) from existing Vitest/tinypool/mocker and Drizzle-kit nested esbuild. No `audit fix --force` because it would force potentially breaking toolchain versions.

## Latest verified G7 extended offline and PWA checkpoint — 2026-10-13
- All work used the **D** Windows checkout, still on `feat/g5-online-sync` HEAD `2cae801`, with local changes not committed or pushed. No production, Linux, `main` or confidential data accessed.
- Durable owner-scoped Dexie outbox is now code-implemented for create, versioned update and delete. Independent `npm run test:browser:g7:postgres:local` PASS in real Chrome→Fastify→disposable PostgreSQL for offline create/edit/complete/delete, workspace remount, reconnect CRUD/conflict retention, explicit conflict resolution, dropped-response idempotent retry, and PostgreSQL clean shutdown.
- Production PWA static-shell files: `apps/web/public/sw.js`, `manifest.webmanifest`, `dayflow-icon.svg`; registration only in production build. **Only static HTML/hashed JS/CSS/manifest/icon** cached, never `/api/*` or private responses. Standalone `npm run test:browser:g7:pwa:local` PASS for offline navigation and offline reload in Chrome with no JavaScript or bundle failure; icon and manifest also available offline. An offline cold load **cannot authenticate the owner**; the UI accurately asks for server connection and does not surface private owner data.
- Full independent QA chain PASS: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (17 files, **100/100 tests**), `npm run build`, real G6/G7/G8 Chrome/PostgreSQL scenarios, static PWA offline smoke, `git diff --check`, and `npm audit --omit=dev --audit-level=moderate`. Source proof: `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`. Full `npm audit` still lists 7 **dev** advisories (including 2 critical); no forced potentially breaking upgrade.
- G7 is **verified locally for these scenarios, NOT formally accepted**. Still open: secure owner authorization after cold offline reload, multi-tab/eviction/privacy/failure-injection tests, dev-tool dependency advisories, human Gate review. G8 encrypted off-host Postgres backup/restore drill and G1-A/G1-C security blockers are separate outstanding issues.

## Additional G7 multi-owner read/write isolation QA — 2026-10-13
- Every durable Dexie mutation carries `X-Dayflow-Owner` bound to its persisted owner. TaskWorkspace's bootstrap and pull requests now also bind the expected owner; Fastify checks any supplied `X-Dayflow-Owner` against the authenticated cookie owner for sync reads and writes. Old online clients without that optional header remain compatible. This prevents a stale browser tab from caching another owner's snapshot or replaying old mutations after an account switch.
- Real Chrome/Fastify/disposable PostgreSQL negative test switches cookie from owner A to B, verifies that A-bound `/api/sync/push`, `/api/sync/bootstrap` and `/api/sync/pull` are all rejected HTTP 403 and owner B's tasks remain empty; **PASS**. Typecheck + build + G7 browser E2E PASS, PostgreSQL stopped. Full 100/100 unit tests and prior complete local QA chain also PASS.
- Still no commit/push/merge, no Linux/production, no human Gate acceptance. Remaining: secure cold offline re-authentication, storage eviction and session change detection in other tabs, G8 offsite database restore, G1 security and G9 release.

## Active G7 durability repair — 2026-10-13
- Inspected D-local online task mutation paths and found that status toggles and deletes still wrote through legacy REST while online, bypassing the durable G7 outbox. Implemented **persist-before-send** for both online and offline PATCH/DELETE UI operations, replaying them using existing G5 idempotent `/api/sync/push`, keeping the original mutation ID across ambiguous responses.
- Updated TaskWorkspace mock server for create/update/delete sync results and added regression for a server-committed status response lost in transit. Targeted TaskWorkspace React Vitest PASS: 12/12 tests across two files. Full repo QA and live PostgreSQL E2E for the new path are still pending; do NOT infer Gate acceptance from unit tests.
- Next: add real-browser lost-response cases for online complete/delete, rerun full QA, then review remaining online form-edit durability. No production/SSH/commit/push.

## G7 online quick-action durability — live E2E confirmed (2026-10-13)
- All TaskWorkspace complete/reopen/delete writes now persist to the same owner-scoped Dexie outbox **before sending even when online**, with stable mutation UUID and expected revision. Existing inline form edit still uses a direct online sync call and is the next scoped hardening task.
- React TaskWorkspace tests (12/12 in two files) PASS, including simulated server-accepted completion whose response was lost and replayed without a second revision. Real Chrome/Fastify/isolated PostgreSQL G7 suite PASS (exit 0) with new markers `G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS` and `G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`, along with all previous offline CRUD, two-tab and account-switch checks; temporary PostgreSQL stopped.
- Full-repo format/lint/unit audit for this incremental change and the G5 direct edit-path hardening are still pending. Do not mark Gate accepted.

## Latest comprehensive local QA and account-session privacy hardening — 2026-10-13
- Added owner-session revalidation on focus/reconnect/visible tab in `apps/web/src/App.tsx`: if another tab changes the shared cookie to a different owner, the old private TaskWorkspace unmounts and the user is asked to log in again; a temporary network failure does NOT discard IndexedDB outbox data. New App component test PASS and real Chrome owner A→B account switch E2E printed `G7_STALE_TAB_PRIVATE_VIEW_HIDDEN_AFTER_ACCOUNT_SWITCH=PASS`.
- Online complete/reopen/delete quick actions now persist to the owner-scoped Dexie outbox before network send, and the server's idempotent mutation handling keeps the same key on lost-response retry. Real Chrome/PostgreSQL G7 E2E printed `G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS` and `G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`. Existing offline CRUD, two-tab, owner-bound push/bootstrap/pull 403, and PWA smoke all PASS.
- Fixed a flaky G6/G8 E2E assertion: the offline queue UI appears before the mocked network request is necessarily intercepted. The test now waits for the specific server-committed create request before asserting the response was dropped; no application behavior changed for that fix.
- **FULL local QA PASS:** `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (**102/102 in 17 files**), `npm run build`, G6/G8 and G7 real Chrome→temporary PostgreSQL E2E, G7 production static-shell offline PWA E2E, `npm audit --omit=dev --audit-level=moderate` (0 production vulnerabilities), and `git diff --check`. Disposable PostgreSQL stop PASS; no Git commit/push, no production/Linux/SSH.
- STILL OPEN: online edit FORM uses direct versioned sync (unlike quick actions) and needs durable persist-before-send hardening; G7 secure cold offline reauthentication/private cache access, quota/eviction failure tests and acceptance; G8 encrypted offsite DB backup/restore; G1 security hardening; development-tool audit advisories and human Gate approvals.

## G7 full-form edit durability — Chrome/PostgreSQL verified (2026-10-13)
- Full edit form is also persisted into Dexie before *any* online/offline write. The existing G5 conflict review is preserved: server conflict retains the draft and original mutation, explicit overwrite creates a new mutation UUID/current server revision and includes any revised form content, while `Giữ bản trên máy chủ` discards the owner-bound conflict record. Ambiguous network responses retain the original UUID/payload for background replay.
- `flushPendingChanges` exposes a synchronous per-mutation result callback without weakening strict acknowledgement validation; `retryConflictedChange` accepts amended patch under a fresh ID for explicit overwrite only.
- Scoped TypeScript PASS; React/IndexedDB targeted tests PASS (24/24 across two files, including changed-draft conflict overwrite, conflict discard and lost online edit response). Real Chrome/Fastify/disposable PostgreSQL G7 suite PASS exit 0 with new `G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`, plus prior status/delete, offline CRUD, multitab and owner-switch cases; test DB stopped.
- Full repository QA, G6/G8 regression and PWA run are pending before this new change is considered fully verified. G7 cold offline owner verification remains a design/security blocker; no formal Gate acceptance.

## Most recent complete independent verification — 2026-10-13

**This section supersedes older incremental QA counts and items marked pending above.** Run from `D:\projects\dayflow`, branch `feat/g5-online-sync`, HEAD `2cae801`, still uncommitted:

```
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser:g6g8:postgres:local && npm run test:browser:g7:postgres:local && npm run test:browser:g7:pwa:local && npm audit --omit=dev --audit-level=moderate && git diff --check
```

**Whole chain PASS with exit code 0:** full Prettier/ESLint/TypeScript, **103/103 unit tests in 17 files**, production bundle, G6/G8 and G7 live Chrome→Fastify→isolated PostgreSQL (both temporary databases stopped), static-only PWA offline cold UI reload with private data still gated by login, zero production dependency advisories, and tracked-diff whitespace check. New G7 live markers confirm dropped HTTP responses after COMMIT replay the SAME mutation ID and produce no double-write for **complete, delete and full-form edit**, alongside previous offline CRUD, two-tab concurrency, explicit conflict review, and session/account-switch isolation. Evidence: `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.

**NOT DONE / NOT ACCEPTED:** formal human Gate acceptance, private offline cold reauthentication/at-rest security review, browser storage eviction/quota failure recovery, full dev dependency advisory remediation, G8 *offsite encrypted database* restore drill, G1-A/G1-C Linux security blockers, exact commit CI, G9 release. No approval for commit/push, production/Linux/SSH/DB changes or main merge.

## Runnable DayFlow V2 Windows local review deliverable — 2026-10-13
- Operator requested actual software rather than planning only. Built `START_DAYFLOW_LOCAL.bat` plus root `npm run demo:local`, `demo:smoke`, `demo:package` using `scripts/start-local-preview.mjs` and `scripts/package-local-preview.mjs`.
- Local app: **production-built React/Vite/PWA assets** served through loopback Vite preview at `http://127.0.0.1:5180`; authenticated Fastify API over same-origin proxy; persistent **dedicated localhost PostgreSQL 17** on `127.0.0.1:55434`, database `dayflow_test_local_preview`, role `dayflow_dev`. The launcher **refuses external DATABASE_URL/NODE_ENV=production**, checks port availability and never touches real services. First launch bootstraps a DEMO owner and five useful Vietnamese tasks, then persists data across restarts.
- Login credentials are generated locally, stored ONLY under Git-ignored `.artifacts/dayflow-local-preview/LOGIN-LOCAL-ONLY.txt` (and local-secrets.json). No secret values were written to source, public docs, answer or ZIP. First Postgres Windows cluster was WIN1252 and failed Vietnamese insert; fixed `initdbFlags=[--encoding=UTF8,--locale=C]` and guarded existing UTF8. Original temporary WIN1252 test folder preserved at `.artifacts/dayflow-local-preview/postgres-data-WIN1252-initial`, not deleted.
- **Real Chrome end-to-end local demo smoke PASS** for auth, Vietnamese seeded tasks, create → PostgreSQL → reload, desktop/mobile Calendar screenshots, Settings and clean Postgres shutdown. Second and third runs printed `DAYFLOW_LOCAL_PREVIEW_POSTGRES_REUSED=PASS` and all smoke markers PASS, proving persistent cluster restart. BAT `--smoke` also passed.
- Deliverable screenshots: `.artifacts/dayflow-local-preview/DAYFLOW_CALENDAR_DESKTOP.png` and `DAYFLOW_CALENDAR_MOBILE.png`. Vietnamese guide: `docs/DAYFLOW_LOCAL_PREVIEW.md`. Credential-free portable ZIP: `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip`, package privacy/required UI/launcher validation PASS. **Independent clean unzip + npm ci + local PostgreSQL install + npm run demo:smoke PASS**, confirming the portable handoff works on this same Windows PC.
- After packaging, discovered that Vitest scanned the extracted portable source copy inside ignored `.artifacts/` and inflated 103 genuine tests to 206. Corrected `vitest.config.ts` to exclude `**/.artifacts/**` while keeping Vitest defaults. Independently reran **full format/lint/typecheck and 103/103 tests in 17 files**, production-only audit zero findings and `git diff --check`: **PASS** (exit 0). Demo `npm run demo:package` was rerun and ZIP privacy check PASS after the test-runner fix. This remains a **local review demo only**, NOT staging/production, NOT formal G6–G8 Gate acceptance.
- **Live session actually started through `npm run demo:local` via MCP**: `DAYFLOW_LOCAL_PREVIEW_POSTGRES_REUSED=PASS`, `DAYFLOW_LOCAL_PREVIEW_API_AND_AUTH=PASS`, `DAYFLOW_LOCAL_PREVIEW_READY=PASS`; independent GET `http://127.0.0.1:5180/` returned 200, `/api/health` returned 200 and anonymous `/api/auth/me` was denied. The app is running on the user's Windows PC as of this checkpoint; if the MCP process exits, double-click the BAT to relaunch. ZIP at `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip` is 412,536 bytes, verified on the Windows device; not a ChatGPT sandbox attachment.
- No Git reset/commit/push, `main`, Linux/SSH, production DB/secrets or deploy. G1/G8/offline cold-unlock/security blockers and dev-tool advisories remain.

## Linux server deployment — PRIVATE STAGING RUNNING AND VERIFIED (2026-10-13)
- Operator explicitly requested DayFlow deployment to Linux. Authenticated over the **verified existing SSH host key** as **`dayflow-dev`** using its dedicated Windows key. Windows system OpenSSH binary returned exit 255; an alternate installed Git OpenSSH client authenticated successfully; no root credential was read/used.
- Read-only Ubuntu 22.04.5 x86_64 inventory: Node v26.7.0, npm 11.19.0, unzip present, ~99 GB free home filesystem, ~10.8 GB available RAM, home private mode 0700; candidate localhost ports 5183 UI and 55435 PostgreSQL not listening. The Linux Desktop Commander device itself remains offline, but SSH from the authorized Windows MCP works.
- **Scope boundary:** deploy a new **unprivileged staging/review instance** under `dayflow-dev` home, NOT an unaudited public production cutover. No root, sudo, Docker socket, system Nginx/Cloudflare/UFW, production DB/ports/config/secrets, or existing service modifications. G1-A old root SSH key and G1-C isolation still **NOT PASSED**; G8 encrypted off-host DB restore and public HTTPS/release readiness not passed.
- Local source remains dirty branch `feat/g5-online-sync` at `2cae801`; new staging ports are overridable through guarded `DAYFLOW_PREVIEW_UI_PORT`/`DAYFLOW_PREVIEW_PG_PORT` in the local preview script, still loopback-only. Full local Prettier/lint/typecheck/103 unit tests/build, ZIP whitelist and `git diff --check` PASS after change. Transfer only the verified credential-free ZIP, never Windows demo DB/.artifacts.
- **Actual Linux deployment PASS:** Windows secret-free review ZIP was rewritten with POSIX paths and SHA-256 `2f1aacd9f96789f063adf5444f89ec1fa7b297c91949618eee412e7c6a6b1390`, matched after SCP. Extracted new private release `$HOME/dayflow-staging/releases/20261013-2f1aacd9/` under `dayflow-dev`; `npm ci --ignore-scripts` and Linux TypeScript/Vite production build PASS, current symlink points to this release. No GitHub commit/push; Linux running this verified uncommitted source ZIP, not old remote HEAD.
- **Private database and boot repair:** PostgreSQL 17 is bundled under a staging-local ignored package, localhost `127.0.0.1:55435`. Linux lacked soname symlinks for **already-bundled** ICU60. Created only three symlinks under its `@embedded-postgres/linux-x64/native/lib`, `ldd` now no missing libraries; no sudo/apt/system libraries. Earlier failed ZIP and logs preserved as isolated artifacts, no unrelated data overwritten.
- **Runtime verified:** `node scripts/start-local-preview.mjs` detached under `dayflow-dev`, bound `127.0.0.1:5183` with authenticated Fastify API; fresh SSH sessions verified HTTP 200 health, anonymous HTTP 401, ports **5183/55435 loopback ONLY**, demo secret file mode `600`, process alive after SSH disconnect. Windows uses a verified-key SSH local tunnel 5183→5183; URL `http://127.0.0.1:5183`.
- **Real browser E2E through the SSH tunnel PASS** on Windows: Chrome login, seeded Vietnamese owner tasks, online create→reload persistence, offline create→reconnect persistence, Calendar desktop/mobile no overflow, Settings, and test-fixture cleanup. A scoped staging stop/restart test released both ports and removed PG postmaster.pid, then restarted same persisted PostgreSQL cluster (`DAYFLOW_LOCAL_PREVIEW_POSTGRES_REUSED=PASS`); real Chrome E2E again PASS after restart. Node SIGTERM did not emit the usual PostgreSQL-stop marker; operational shutdown was verified by absent PID/listeners/postmaster.pid instead, and original logs were preserved.
- **Access/operational files** only on user's Windows PC and Git-ignored: `.artifacts/deploy/CONNECT_DAYFLOW_LINUX.bat` (SSH tunnel) and `.artifacts/deploy/LOGIN_DAYFLOW_LINUX_STAGING.txt` (test credential). **Never print/share stage password**, never commit ignored files. Runbook: `docs/DAYFLOW_LINUX_STAGING_20261013.md`. Screenshots in ignored `.artifacts/deploy/`. Process survives SSH disconnect, **not auto-started after Linux host reboot** because no user systemd supervisor was enabled.
- **Final QA after all source/package/runbook changes:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm audit --omit=dev --audit-level=moderate && git diff --check` returned exit 0: **103/103 unit tests in 17 files**, code quality and build PASS, zero production dependency audit findings. This does not replace Linux private staging Chrome E2E and fresh-SSH checks, which also PASS.
- **Public/production deployment STILL BLOCKED:** G1-A old root key, G1-C dev/prod isolation negative tests, G8 off-host encrypted DB backup and restore drill, public TLS/proxy/monitoring/CI/approval remain. Do not touch existing Nginx, Cloudflare, Docker, firewall, DNS, SSH auth or prod DB without fresh scoped operator permission. This is a private technical staging, NOT a G9 acceptance.

## Linux staging operational follow-up + G8 readiness — 2026-10-13
- Began by independently reading this D-local STATE, last JOURNAL, current `feat/g5-online-sync` HEAD `2cae801` and dirty state. Windows tunnel at `http://127.0.0.1:5183` answered web/API **HTTP 200**. Linux staging service remains PRIVATE, not a public deployment.
- Ran **fresh real Chrome E2E via Windows SSH tunnel to Linux staging**, now also testing G8 exported backup JSON (format/version, Vietnamese owner task data, persisted timezone/settings) without saving task contents to Git/logs. Browser suite **PASS, exit 0**: login, online create/reload, offline/reconnect, calendar desktop/mobile, Settings, JSON export and fixture cleanup.
- Read-only Linux dev-account prechecks: bundled PG17 native package includes `postgres/initdb/pg_ctl` only, **no pg_dump/pg_restore**. System `pg_dump` is 14.24; official PostgreSQL compatibility forbids dumping a newer major server with an older client. PG17 client not available in existing APT cache. **NO PostgreSQL DR drill claimed**; encrypted off-host restore still G8 blocker. Prepared `docs/DAYFLOW_G8_DB_RESTORE_PLAN_20261013.md` for compatible PG17 client and isolated encrypted restore verification; **no system apt/root/prod modification**.
- Read-only user-service precheck: `systemctl --user` was `degraded`, `loginctl dayflow-dev Linger=no`. **No automatic reboot start**; stage remains on tested `nohup` and Windows SSH tunnel. Drafted portable operator script `scripts/dayflow-staging-ops.sh` (restricted user, guards PID/release/port, start/status/stop), Windows shell syntax check `sh -n` PASS, **NOT INSTALLED/ACTIVATED on Linux**: remote preparation write was blocked by the tool. No instance was stopped/changed by this work.
- Extended Linux runbook `docs/DAYFLOW_LINUX_STAGING_20261013.md` with latest E2E/operational caveats. Still blocked for public G9: G1-A root key, G1-C dev/prod isolation, G8 off-host encrypted DB recovery, TLS/CI/staging approval.
- **Final follow-up QA** on D: `npm run format:check && npm run lint && npm run typecheck && npm test && git diff --check` PASS, **103/103 unit tests in 17 files**, exit code 0; `sh -n scripts/dayflow-staging-ops.sh` PASS. Latest tunneled Chrome Linux staging E2E with G8 JSON download PASS exit 0. The new docs and untracked ops script are kept local, not deployed/committed. Next: scoped PG17-client + DR sandbox preparation and supervisor approval; do not auto-run privileged operations.

## 2026-10-13 — Explicit GitHub push approval; exact Vite preview domain fix (in progress)
- Operator requested `đẩy lên repo github` and supplied the preceding Vite blocked-host message for `dayflow.liuduc.site`. This is explicit permission to commit and push the current **`feat/g5-online-sync` branch**, **NOT** to force-push, merge main, deploy/restart Linux, configure DNS/SSL/firewall, or declare production Gate accepted.
- Confirmed D-local branch HEAD `2cae801` and matching GitHub feature ref; GitHub connector confirms `leuyduc/dayflow` is a **PUBLIC** repository and authenticated user has push permission. Source includes older uncommitted G6/G7/G8/staging work; do not reset/checkout.
- Added only `preview.allowedHosts: ["dayflow.liuduc.site"]` in `apps/web/vite.config.ts`; preserved localhost binding and did NOT set `allowedHosts: true`. Added `scripts/test-vite-preview-hosts.mjs`, npm `test:preview:allowed-hosts` and a CI check. Real Vite preview accepted the exact requested domain and localhost, rejected another hostname HTTP 403. Build, Prettier, lint and TypeScript PASS.
- **Pre-push QA completed PASS (exit code 0)**: full formatting, lint, TypeScript, **103/103 unit tests in 17 files**, build, exact Vite Host check (allowed/localhost HTTP200, untrusted HTTP403), G6/G8 and G7 real Chrome→disposable PostgreSQL E2E, PWA offline shell, `npm audit --omit=dev --audit-level=moderate` (zero production dependency findings), `git diff --check`. Gitignored `.artifacts` data untouched. Public GitHub source preflight scanned **134 tracked/untracked source files**: no blocked private paths, known token/private-key signatures, oversized files or symlinks. CI configured to rerun Vite host test after build. Local README updated to clarify current V2 status. This is a pattern-based scan, not a guarantee that all secret classes were detected.
- **GitHub push CONFIRMED:** 78-file feature commit `a10afb6727efdb10850dc2b18dcf0d1e50370188` was created from D and pushed using ordinary non-force push `2cae801..a10afb6` to `origin/feat/g5-online-sync`. GitHub connector independently fetched commit and verified 78 changed files; repo is PUBLIC. The original `main` was not modified. The GitHub combined legacy status endpoint returned no statuses (not proof of Actions CI pass), so **exact-SHA workflow checks remain to be verified**. A follow-up documentation-only checkpoint is being committed to preserve this updated Git state on GitHub. Current Linux staging still runs the prior ZIP; **no redeploy/restart performed by this Git push**.

## 2026-10-13 — GitHub exact-SHA CI failure diagnosed; build-order fix pending push
- GitHub Actions run `38398862876` for docs checkpoint SHA `d4399ad`: `checks` job **SUCCESS** (format/lint/typecheck/103 tests/build/exact Vite host check), but `online-sync-postgres-integration` and `g4-browser-postgres-e2e` **FAIL** before tests at `npm run build -w @dayflow/api`, TypeScript TS2307 unable to resolve `@dayflow/domain` on fresh runner because its workspace was not built first.
- Applied minimal change to **both CI PostgreSQL jobs**: insert `npm run build -w @dayflow/domain` before API build. No product code, database or Linux configuration was changed. This is a CI workflow prerequisite fix; exact-SHA CI pass is **NOT YET VERIFIED**.
- **Fix preflight PASS:** local `npm run build -w @dayflow/domain` followed by `npm run build -w @dayflow/api`, full Prettier, lint, **103/103 unit tests**, and `git diff --check` all passed (exit 0). Only CI workflow and continuity docs changed. Next: non-force push CI repair to `feat/g5-online-sync`, verify remote SHA and monitor all three Actions jobs; do not claim G9 release.

## Next safe action
Review the dirty tree (including all originally uncommitted files) and commit or push only when asked. Keep any future commit on `feat/g5-online-sync`. Do not merge to `main`. All local code quality commands now PASS (full-repo format, lint, typecheck, 103 tests, build, G6/G7/G8 Chrome/PostgreSQL E2E (including lost-response for online full edit/status/delete, account-switch privacy and session fencing) and G7 offline PWA smoke); offsite encrypted G8 DB recovery drill and G7 full offline authorization/security acceptance remain pending. The startup guide references `docs/CHATGPT_EXECUTION_PROTOCOL.md`, which is absent from this local tree; treat that guide as incomplete rather than inventing its contents.

Before calling G6 or G8 accepted, review `docs/V2_G6_G8_LOCAL_E2E_20261013.md`, resolve any remaining accessibility/edge-case defects, and complete the separately authorized offsite encrypted DB backup/restore drill for G8. No production host operations under this scope. G7 offline CRUD and static PWA shell now have scoped live Chrome evidence. Remaining G7 acceptance risks: secure offline owner authentication on cold reload, multi-tab/eviction/account-isolation and security review, toolchain dev advisories, human Gate sign-off. G9 stays closed until a human asks for a release.

## Forbidden without a new, explicit approval
- Merge or force-push `main`.
- Deploy, production migration, production database, SSH, firewall, or secret handling.
- Treating green unit tests as Gate acceptance.
- Reviving OpenCode/Muse as the coder.

## Safety
- Human acceptance is still required at each gate.
- This file is an operator checkpoint. Recheck `git status` and GitHub before acting on it.
