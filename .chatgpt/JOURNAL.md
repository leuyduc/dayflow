# DayFlow V2 — ChatGPT Execution Journal (append only)
Public, sanitized record of actions and supporting evidence. **ChatGPT-only continuity; not required Muse input.**

## 2026-10-11 — V2 direction and design
- User selected option D: Linux hosts Muse/OpenCode, web, backend and synchronized data.
- Created `design/linux-fullstack-v2`, authored architecture, sync, infra security, bootstrap and G0–G9 plan. V1 kept for reference. No application code or deployment.
- Result: DESIGN FILES WRITTEN. Gate G0 still required.

## 2026-10-12 — Windows remote MCP access
- Desktop Commander connection verified online; Windows OpenCode CLI version 1.19.0, Git and Node available.
- Created separate new root-admin SSH key and verified local ACL. Operator validated Linux SSH host fingerprint out-of-band. Fresh SSH admin login succeeded.
- Result: Windows-to-Linux administrative SSH access verified. **Old previously exposed root key was not yet revoked.**

## 2026-10-12 — G0 Linux audit
- Checked distro, CPU/RAM/disk, running ports/services, Docker, Nginx, SSH, UFW, Git/Node/npm, OpenCode in PATH.
- Found active existing workloads, Docker-published network ports and production isolation concerns. Linux OpenCode not found in root PATH.
- Result: G0 INFORMATION COLLECTED; design requires strict isolation; no server deployment.

## 2026-10-12 — G1-A revocation preflight
- Tried exact-match checks of old/new key in authorized_keys. Shell comparison was inconsistent; follow-up verification was blocked by tool safety enforcement.
- **No public key was revoked.** User explicitly instructed to skip to the next step.
- Result: G1-A DEFERRED; compromised key still a security concern.

## 2026-10-12 — G1-B restricted dev account
- Created separate Windows dev SSH key with owner-only private-file ACL.
- Linux `dayflow-dev` user and private home created, password locked, no extra membership according to `id`; new public key installed.
- Updated SSH drop-in from `AllowUsers root` to `AllowUsers root dayflow-dev` after validation. An initial overly strict validator caused an automatic rollback; revised validator handled `sshd -T` as two `allowusers` lines.
- Controlled SSH reload performed; fresh root and dev logins both succeeded. SSH/Nginx/Docker/UFW/Cloudflared remained active. Negative privilege test via remote MCP was blocked.
- Result: G1-B PARTIAL PASS, G1 overall NOT PASSED. Not yet installed Muse/OpenCode on Linux.

## 2026-10-12 — ChatGPT-only persistent state protocol
- User required durable project journal/lessons due to ChatGPT context limits, clarified Muse uses OpenCode's native session/context/cache and MUST NOT be forced to reread specs for ChatGPT's sake.
- Created separate `.chatgpt/` files under the V2 design branch. Scoped recovery/checkpointing entirely to ChatGPT, with latest-state-first reading to save work and tokens.
- Result: DOCUMENTATION/CONTINUITY CHANGE ONLY. No remote machine modifications in this step.

## 2026-10-12 — Consolidated master plan
- Re-read current ChatGPT checkpoint, execution journal, G1 change plan and V2 implementation plan; summarized end-to-end G0–G9 dependencies, gate evidence, isolation and release workflow.
- Wrote `docs/V2_MASTER_PLAN.md` to the V2 design branch. Muse's own context/cache policy remains independent; the `.chatgpt/` recovery files continue to apply only to ChatGPT.
- Result: MASTER PLAN RECORDED; no code, server or gate-state changes. G1-A old key outstanding; G1-C isolation next.

## 2026-10-12 — G1-C read-only isolation audit
- Authenticated to Linux as restricted `dayflow-dev`, confirmed UID/GID and only its own group, reviewed filesystem modes and Docker socket metadata without reading secret contents.
- Passive network listener inspection detected multiple local-only and published services. A no-payload TCP connect from `dayflow-dev` succeeded to 3 pre-existing localhost services (including a database-like endpoint), demonstrating absence of sufficient local-network isolation.
- Sensitive file read/write permission probes were blocked by tool safety controls; these are BLOCKED/UNVERIFIED, not PASS. The current process net namespace was observable, but PID1 comparison was inconclusive.
- Resource snapshot remained about 10 GiB available RAM and 101 GiB free disk on a multi-workload host.
- Created `docs/V2_G1C_ISOLATION_AUDIT.md` with remediation options and acceptance tests. **No Linux configuration or service changes**.
- Status: G1-C AUDITED / NOT PASSED; G1 overall NOT PASSED; G1-A exposed key unresolved; G1-D OpenCode installation not started. Next: approve a stronger isolated environment and egress controls.

## 2026-10-12 — Proposed direct Ubuntu MCP device
- Operator proposed connecting Ubuntu directly as a second Desktop Commander device to remove repeated Windows→SSH relay.
- Confirmed official provider supports Ubuntu/Linux Remote Device with `npx @wonderwhy-er/desktop-commander@latest remote` and OAuth pairing; requires local user initiation/approval.
- Read-only SSH as `dayflow-dev` showed Node v26.7.0, npm/npx 11.19.0, writable developer home, no prior device pairing confirmed.
- Remote launch attempt through Desktop Commander/SSH was blocked by platform safety checks; **no remote command installation, device pairing, service configuration or Linux changes completed**.
- Operator must initiate the pairing interactively under unprivileged developer user; verify second device online afterwards. G1-C isolation remains FAILED and G1-A exposed admin key is unresolved.

## 2026-10-12 — Two-device MCP and Windows Muse probe
- Verified both devices Online. Ubuntu ping, restricted home metadata and home directory listing succeeded. Ubuntu direct shell calls remain blocked by tool safety restrictions; identity via direct terminal not verified.
- Inspected non-secret Ubuntu Desktop Commander settings: default shell Bash, allowedDirectories empty, standard blockedCommands. No config changed.
- Used Windows MCP to inspect OpenCode 1.19.0. Muse Spark 1.3 appears in the model list; CLI supports noninteractive run.
- Started harmless one-line Muse connection probe on Windows. No output returned; process remained waiting. Terminated only the probe session; subsequent Desktop Commander session listing was empty. Muse runtime NOT VERIFIED.
- No Linux changes and no DayFlow implementation. Gate status unchanged: G1-C isolation failed, G1-D pending.

## 2026-10-12 — OpenCode Go provider smoke retry
- Checked CLI provider credential status: OpenCode Go, OpenRouter and nvidia-glm are configured (provider names only; no secrets retrieved).
- A minimal `opencode-go/muse-spark-1.3-contributor` response test produced no output and remained blocked. Terminated only that test process.
- Result: Muse runtime not verified; do not hand off coding yet. No server or repo changes.

## 2026-10-13 — Usable planner slice, uncommitted, handoff recorded
- Continued `feat/g5-online-sync` at `2cae801` after OpenCode Go stopped with a quota error. No Linux SSH, production database, deploy, or merge.
- Working tree already held uncommitted schedule-overlap, calendar, and backup work. This session finished settings persistence, applying backup schedule settings inside the import transaction, Today day navigation, calendar day/week/month, manual place, per-block suggestion reject, schedule fields on the task edit form, and subtasks through the API, sync update, and backup v1.
- Verification observed locally: `npm run typecheck` passed; `npm test` passed with 78 tests; eslint passed on the touched files. `DATABASE_URL` was absent, so `scripts/browser-g6-g8-e2e.mjs` was not run. No commit and no push.
- Checkpoint rewritten in `.chatgpt/STATE.md`. The 2026-10-12 statement that G2–G9 had not started was stale relative to commits already on this branch.
- Result: CODED AND UNIT-TESTED, UNCOMMITTED. G1 remains NOT PASSED. G7 and G9 remain NOT STARTED. Next: review and commit only if asked; live Chrome+Postgres e2e needs an isolated localhost `dayflow_test_*` database.

## 2026-10-13 — G8 local repair and independent QA; still uncommitted
- Resumed from local Windows working tree; verified branch `feat/g5-online-sync` and public origin both at `2cae801`. Kept prior dirty files intact. No fetch/reset/merge.
- Found that JSON export silently used browser/default schedule settings instead of persisted owner settings, that settings-only restore was disabled when all task IDs already existed, and that Settings UI would remain stale after import. Fixed export to load saved settings, enabled settings-only import, refreshed Settings on import success, and extended backup v1 with optional `weekStartsOn` and `theme` while accepting old v1 files.
- Aligned the backup import API request-body limit with the existing 2 MB file limit. Export now refuses to claim success if its file cannot pass the domain backup parser. Added six regression tests (domain, web, API).
- Verification on local Windows: `npm run lint` PASS, `npm run typecheck` PASS, `npm test` PASS (15 files / 84 tests), `npm run build` PASS, `git diff --check` PASS, targeted Prettier check PASS. Full `npm run format:check` FAILS for 36 existing-project files; no unrelated mass-formatting was done.
- Chrome + isolated PostgreSQL G6/G8 E2E NOT RUN: `DATABASE_URL` absent and no test database configured. GitHub CI NOT CHECKED, and no Gate acceptance claimed. The referenced `docs/CHATGPT_EXECUTION_PROTOCOL.md` is missing locally; current `.chatgpt/STATE.md` provides the handoff.
- No commit, push, production operation, Linux/SSH access, or `main` change. Next: provision/use isolated local `dayflow_test_*` database for browser E2E, address formatting in a controlled separate scope, review dirty tree before user-authorized commit.

## 2026-10-13 — Windows workspace relocated to D: (user-requested)
- User identified the C checkout as the wrong drive and designated `D:\projects\dayflow` as the active workspace. Existing D checkout was an older CLEAN `prompt/agent-bootstrap` at `e6387cb`; it was renamed to `D:\projects\dayflow-legacy-bootstrap-20261013` before any copy.
- Copied ALL C checkout contents (including .git, hidden, ignored, and untracked source files) to D. Robocopy reported 15,352 files / ~237 MB copied, no errors. The dry-run comparison reported zero metadata differences. Four npm workspace junctions under `node_modules\@dayflow` were re-created with D targets.
- Verified the active D repository has HEAD `2cae801`, branch `feat/g5-online-sync`, original uncommitted work, and the expected GitHub origin. Re-ran `npm run lint` (PASS), `npm run typecheck` (PASS), `npm test` (84/84 PASS), `npm run build` (PASS) on D.
- Updated D-local `START_HERE.md`, `AGENTS.md`, `.chatgpt/README.md`, and `.chatgpt/STATE.md` to consistently identify D as the sole working tree and prevent accidental resets from stale GitHub or edits to C. Source `C:\Users\ABC\dayflow` remains untouched for fallback and older D repository remains archived.
- No commit, push, merge, main change, deploy or Linux operation. GitHub still does not contain the uncommitted G6/G8 work. Preexisting 36-file full-repo format issue and absent live G6/G8 Postgres E2E remain open; no Gate acceptance claimed.
- Next: ALL work via Windows MCP at `D:\projects\dayflow`. Do not delete either backup without explicit request.

## 2026-10-13 — G6/G8 isolated real-browser E2E unblocked
- Started by re-reading D-local STATE/JOURNAL/LESSONS/START_HERE/AGENTS and verifying live Git branch `feat/g5-online-sync` at `2cae801` with prior dirty work intact. Operator requires this context recovery before every step/new session and after cache loss; the requirement was added to D-local `START_HERE.md` and `STATE.md`.
- Identified prior documented disposable Windows PostgreSQL 17 test strategy. Installed only `embedded-postgres@17.10.0-beta.17` into gitignored `.artifacts/postgres-sandbox/` using `--ignore-scripts` (not an app dependency). Added reusable `scripts/test-g6-g8-postgres-local.mjs` and npm command `test:browser:g6g8:postgres:local`. New wrapper binds PostgreSQL to 127.0.0.1:55433, generates runtime-only credentials and isolated `dayflow_test_*` database, invokes real Chrome/Vite/Fastify/Drizzle/PostgreSQL e2e, and stops the sandbox.
- Ran `npm run test:browser:g6g8:postgres:local` on D; observed G6 scheduling accept and unschedule persistence PASS; G8 JSON download, merge import and invalid-file no-write PASS; full script exit 0; PostgreSQL stop PASS. The test did not access Linux, production credentials, or other databases.
- Updated STATE status G6/G8 from unit-only to live E2E verified for tested scope; additional custom-settings/restore/calendar manual cases and offsite backup/restore drill remain. No full Gate acceptance, no commit/push/merge. Future E2E can run without persistent DATABASE_URL.

## 2026-10-13 — G6/G8 browser E2E coverage expanded and audited on D
- Re-read D-local checkpoint and Git state before the next slice. Kept `feat/g5-online-sync` at `2cae801` uncommitted; compared remote feature HEAD, which remained unchanged. No C clone or Ubuntu/production operations.
- Extended `scripts/browser-g6-g8-e2e.mjs` to verify day/week/month calendar navigation, manual placement in actual PostgreSQL, saved nondefault owner timezone/working hours/duration/theme/week-start, exact settings in the downloaded JSON backup, settings-only import with zero new task IDs and live Settings form refresh, overlapping scheduled import transaction rollback (tasks and settings unchanged), and a 390px mobile calendar month with no horizontal overflow.
- Re-ran full `npm run test:browser:g6g8:postgres:local`: all scenarios PASS, exit 0, PostgreSQL started and stopped successfully. Test uses only fixture accounts and ignored .artifacts, no production connection.
- Re-ran local `npm run lint` PASS, `npm run typecheck` PASS, `npm test` PASS (15 files / 84 tests), `npm run build` PASS, `git diff --check` PASS. `npm run format:check` still FAILS on 36 existing-file formatting deviations; did not mass-reformat unrelated files.
- Wrote reproducible evidence and limitations to `docs/V2_G6_G8_LOCAL_E2E_20261013.md`; updated D-local STATE, START_HERE and V2 implementation handoff. Gate G6/G8 remain PENDING HUMAN ACCEPTANCE; G8 offsite encrypted database backup/restore drill still open. G7/G9 unchanged. No commit/push/merge.

## 2026-10-13 — Windows Prettier portability issue resolved; complete local QA green
- Diagnosed 36 full-repo Prettier warnings: tracked source was mostly checked out as CRLF on Windows (global Git `core.autocrlf=true`). Read-only `npm run format:check -- --end-of-line auto` reduced the warnings to one actual source formatting issue.
- Added `endOfLine: auto` to root `.prettierrc.json`; formatted only the new `apps/api/src/settings/routes.test.ts`. No 35-file unrelated mass-formatting and no Git reset.
- Independently reran on D: `npm run format:check` PASS, `npm run lint` PASS, `npm run typecheck` PASS, `npm test` PASS (84/84), `npm run build` PASS, expanded `npm run test:browser:g6g8:postgres:local` PASS with isolated PostgreSQL stopped, and `git diff --check` PASS.
- Updated STATE, E2E evidence, START_HERE and V2 handoff to remove stale formatting blocker. Current blocker for G8 Gate acceptance remains offsite encrypted database backup/restore; G1 security blockers independent. No commit/push/merge/deploy.

## 2026-10-13 — G7 account-scoped offline-create durable store foundation
- Reread D-local STATE/JOURNAL/LESSONS, verified feature HEAD and unchanged remote before modifications. Authorized autonomous local progress; no commit/push/production.
- Added Dexie and fake-indexeddb dependencies; authored account-scoped IndexedDB snapshot and immutable create outbox in `apps/web/src/offline-store.ts`. Pending writes are acknowledged only when the server echoes the matching mutation ID and task ID; a dropped response retains the same ID for safe idempotent replay. Semantic conflicts are preserved and isolated by owner.
- Added `apps/web/src/offline-store.test.ts`, verified 5/5 PASS and full typecheck PASS. This is foundation only, NOT an integrated offline UX or a completed G7 Gate. Continue TaskWorkspace/App integration and real-browser offline/reconnect tests.

## 2026-10-13 — G7 offline create integration recovered, QA reverified
- On renewed user request, re-read D-local STATE, latest JOURNAL/LESSONS and actual Git status; branch HEAD remained `2cae801`, remote equal, dirty G6/G8 tree preserved.
- Found that a prior in-progress G7 slice had already connected Dexie create outbox to TaskWorkspace and App and added tests, beyond the earlier STATE note. The first typecheck caught a mid-edit missing return; reread the source after the concurrent correction and independently reran typecheck PASS and full Vitest 17 files / 91 tests PASS (including 5 Dexie and 2 offline UI tests).
- Updated STATE to distinguish working offline create UX from incomplete G7 coverage. Next independent slice: durable offline update/delete and real Chrome offline/reconnect under isolated PostgreSQL; no commit/push, no Linux/production.

## 2026-10-13 — G7 offline-create vertical slice validated against real PostgreSQL
- Continued automatically after rereading current D-local STATE/JOURNAL/LESSONS and branch/HEAD; all actions confined to `D:\projects\dayflow` feature branch `feat/g5-online-sync` at `2cae801`. No C copy, main, Linux, production, commit or push.
- Implemented account-scoped Dexie task cache and durable create-only outbox, stable mutation/task IDs, persisted-before-ack quick capture, pending-task UI with other actions disabled, reconnect/focus/manual replay and reload-after-ack. `App.tsx` passes owner ID and prompts on pending signout, preserving data if canceled or if confirmed for a later same-owner login. Synced backend uses existing atomic G5 idempotency.
- Tests: `offline-store.test.ts` 5 PASS, `TaskWorkspace.offline.test.tsx` 2 PASS, existing online task UI regressions PASS. Real Chrome→Fastify→temporary localhost PostgreSQL browser E2E added offline create/reconnect (exactly one task), committed-create/lost-response retry (no duplicate), logout confirmation cancellation; both G7 markers PASS alongside all G6/G8 cases, PostgreSQL sandbox stopped.
- Full independent QA: `npm run format:check` PASS, `npm run lint` PASS, `npm run typecheck` PASS, `npm test` 17 files / 91 tests PASS, `npm run build` PASS, `git diff --check` PASS. `npm audit --omit=dev --audit-level=moderate` PASS. `npm audit` flags 7 dev toolchain advisories, including tinypool critical; no risky automatic --force downgrade/upgrade.
- Authored `docs/V2_G7_OFFLINE_CREATE_PROGRESS_20261013.md` with verified scope/limitations. G7 PARTIAL (offline edits/deletes, full PWA/offline auth and semantic conflict recovery UI not implemented). G8 offsite DB recovery drill NOT DONE. No Gate accepted and no release.

## 2026-10-13 — G7 offline PWA shell, full local regression QA and independent G7 CRUD E2E
- Reread D-local STATE/JOURNAL and current feature Git HEAD before continuing; all work remained on `D:\projects\dayflow`, branch `feat/g5-online-sync` at `2cae801`. No commit/push, Linux/production/main operations or secrets accessed.
- Added production-only registration of a static-only service worker, manifest and icon, and an accurate offline unauthenticated message. The service worker precaches only index.html, immutable hashed JS/CSS, manifest and icon; `/api/*` and private data are excluded. Implemented `scripts/browser-g7-pwa-smoke.mjs` and npm command `test:browser:g7:pwa:local`; tested real Chrome offline navigation AND reload against Vite production preview.
- Initial real Chrome offline PWA test exposed a cached module-script/CSS mismatch from HTTP Vary headers, even though assets were in Cache Storage. Fixed using `Cache.match(request, {ignoreVary:true})` **only for allowlisted same-origin static assets** and reran: `G7_PWA_STATIC_ONLY_CACHE_POLICY=PASS`, `G7_PWA_OFFLINE_RELOAD_SHELL=PASS`, `G7_PWA_NO_PRIVATE_RESPONSE_CACHE=PASS`. No API data or auth tokens cached. `apps/web/src/App.test.tsx` was adjusted to distinguish multiple truthful status messages.
- Independently ran additional isolated real Chrome/PostgreSQL `npm run test:browser:g7:postgres:local`: offline create/edit/complete/delete, workspace remount, reconnect CRUD/conflict preservation, explicit conflict resolution, ambiguous lost-response same-key replay all PASS; temporary PostgreSQL stopped.
- Entire checked QA chain PASS on D: Prettier, ESLint, typecheck, **99/99 tests in 17 files**, production build, existing G6/G8 real Chrome/Postgres regression, PWA offline smoke, `git diff --check`, production dependency audit. Full dev npm audit remains 7 advisories including two critical; no risky `--force` change. Source evidence: `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.
- G7 is extensive local verified functionality but NOT human Gate accepted. Cold offline reload cannot reauthenticate to expose private tasks; multi-tab, storage eviction, cross-owner privacy, dev-tool dependencies need more QA. G8 offsite encrypted PostgreSQL restore drill and G1 security blockers remain.

## 2026-10-13 — G7 replay bound to authenticated owner, live account-switch negative test
- Restored context from D-local STATE/JOURNAL and git status on `feat/g5-online-sync`/`2cae801`; preserved all prior uncommitted changes. This independently verified slice adds `X-Dayflow-Owner` to durable Dexie create/update/delete replay requests and rejects mismatches with the current authenticated Fastify session (403 `owner-session-mismatch`). Older G5 clients omitting the header remain compatible.
- Added Dexie test requiring the correct owner binding on both create and update payloads; full local run now **100/100 tests in 17 files PASS**.
- Extended real Chrome/Fastify/disposable PostgreSQL G7 E2E: switched the same browser origin from owner A to owner B, tried to replay an owner A outbox write with B's valid session/CSRF; got expected HTTP 403 and PostgreSQL showed zero tasks leaked to owner B. Two-tab concurrent replay E2E also emitted PASS in the verified run.
- Full regression chain PASS on D: format, lint, strict typecheck, 100 unit tests, web/API build, G6/G8 real Chrome/PostgreSQL, G7 offline CRUD/conflict/two-tab/owner-switch real Chrome/PostgreSQL, PWA offline static-only smoke, production-only audit, and `git diff --check`. Disposable PostgreSQL processes stopped cleanly.
- Updated `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md` and STATE. No commit, push, merge, deploy, SSH, production secrets or production database. G7 remains NOT formally accepted due offline cold-login/private-data security and further failure testing. G1/G8 blockers unchanged.

## 2026-10-13 — Extended owner-bound sync reads to avoid cross-owner cache poisoning
- Recovered D STATE/Git before the new slice; branch `feat/g5-online-sync` remains at `2cae801` and dirty changes preserved.
- Identified read-side risk: stale TaskWorkspace could cache another user's bootstrap/pull after same-origin cookie change. Moved `X-Dayflow-Owner` comparison into shared Fastify sync auth for GET bootstrap/pull and POST push; TaskWorkspace now tags its read requests with original owner ID.
- Rebuilt and ran real Chrome→isolated PostgreSQL G7 E2E: account switched A→B, A-bound push/bootstrap/pull each received 403; zero writes to B. Browser G7 offline queue and concurrency regressions remain PASS, temp PostgreSQL stopped. No commit/push/production change.
- Updated STATE and evidence; Gate acceptance still requires secure offline cold authentication, session-change UI safeguards and further privacy/storage QA.

## 2026-10-13 — G7 online status/delete writes are now durable before send (unit QA)
- Restored D-local checkpoint and Git HEAD `2cae801`, remote equal; code was still uncommitted, G6/G8/G7 previous work intact.
- Found a data-loss risk: online TaskWorkspace complete/reopen/delete used direct REST PATCH/DELETE and could lose acknowledgment without stable mutation ID. Changed these to persist a versioned Dexie mutation BEFORE any HTTP regardless of navigator.onLine, then replay via existing G5 idempotent push. A failed/ambiguous response preserves the exact ID for retry; server conflicts retain the record.
- Updated existing React mock API and tests to reflect idempotent create/update/delete. Added test simulating PostgreSQL-like commit followed by lost response and verifying replay uses identical mutation ID without second revision. Scoped React UI tests 12/12 PASS. Full QA and real Chrome/Postgres for online-loss regression still pending before acceptance.
- No production, Linux, main, commit, push, secrets or remote writes.

## 2026-10-13 — G7 online PATCH/DELETE ambiguous-response real Chrome E2E PASS
- After recording the focused unit test, extended the isolated Chrome→Fastify→PostgreSQL G7 harness to intercept online complete and delete writes **after server COMMIT**, drop the HTTP response, replay later and verify that all retries carry the original clientMutationId and records increment revision only once.
- `npm run build && npm run test:browser:g7:postgres:local` PASS, exit code 0. New Chrome markers: `G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`, `G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`. Previous offline CRUD, two-tab race, owner-switch negative tests also PASS; temporary test DB stopped.
- G7 next: online edit form still bypasses durable pre-journaling; remediate carefully while preserving human conflict choices and draft content. Scope local only; no commit/push/production.

## 2026-10-13 — Final G7 local QA checkpoint: 102 tests, session privacy and stable E2E
- Resumed from D-local STATE/JOURNAL and verified Git branch/HEAD (`feat/g5-online-sync`/`2cae801`) and dirty worktree before each logical slice; no Git reset or C checkout modifications.
- Hardened `App.tsx` to check `/api/auth/me` on focus, reconnect and visible-tab transitions. A changed/expired session immediately hides the former owner's private workspace without discarding offline IndexedDB records; network failures alone do not trigger logout. Added an App component regression and a real Chrome account switch negative test; both PASS.
- Fastify G5 sync now fences owner-bound bootstrap, pull and push; old A-bound reads/writes under B's cookie return 403. Browser/PostgreSQL confirms B receives zero A tasks. Owner-bound create/update replay headers are verified by Dexie unit tests.
- Resolved a flaky G6/G8 browser lost-response test caused by asserting before its intercepted request had committed; now match the specific create payload and await the server-commit promise with a bounded timeout/cleanup.
- Complete real local regression command PASS: full Prettier, ESLint, TypeScript, **102/102 unit tests (17 files)**, production build, isolated PostgreSQL G6/G8 browser E2E, G7 offline/online lost-response/two-tab/owner-switch browser E2E, PWA offline static-shell reload, production-only audit (0 advisories), `git diff --check`. Temporary database shutdown verified. Exact logs/evidence: `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.
- NOT production ready: secure offline cold reauthentication/private at-rest data design and quota tests, G8 encrypted offsite DB backup/restore, G1-A/G1-C security hardening, dev-only audit advisories, human Gate acceptance remain. Online edit form direct versioned sync still needs the durable G7 persist-before-send workflow. No commit, push, merge, deployment, SSH or production mutation.

## 2026-10-13 — G7 full form edits persisted before HTTP, G5 human conflict review retained
- Restored current D state and feature HEAD, then hardened TaskWorkspace full edit form: record owner-scoped versioned Dexie mutation before any HTTP, even online; ambiguity retains immutable UUID/patch and the edit draft.
- Extended offline-store replay to surface a per-mutation result to the caller and allow explicitly amended form content when the human chooses a fresh-revision conflict override. Server-version choice atomically discards the old owner-bound queued conflict; the existing G5 review/draft UI is retained.
- Targeted TypeScript PASS, focused Vitest 24/24 PASS across TaskWorkspace + offline-store, including post-conflict form changes, server choice cleanup, and committed edit with lost HTTP response followed by SAME mutation retry. Real Chrome→Fastify→isolated PostgreSQL G7 E2E PASS with `G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS` and all previous G7 cases, sandbox stopped.
- Full aggregate QA and all other E2E suites still need rerun after this slice. Nothing was committed or pushed; no Linux/production/main/secret access.

## 2026-10-13 — Complete G7 durable-CRUD and PWA regression chain green (103/103)
- Reread D-local STATE/JOURNAL and verified feature HEAD `2cae801`, with dirty worktree intact and no production or other checkout access.
- G7 now journals online AND offline create, complete/reopen, delete, and full-form edits to account-scoped Dexie BEFORE HTTP. The lost-response after COMMIT regression for full edit was added to real Chrome/Fastify/disposable PostgreSQL and returned `G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS`; quick status/delete same-key replay, two-tab and cross-account tests remain green. G5 human explicit conflict overwrite preserves amended draft.
- The complete chained command `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser:g6g8:postgres:local && npm run test:browser:g7:postgres:local && npm run test:browser:g7:pwa:local && npm audit --omit=dev --audit-level=moderate && git diff --check` returned **exit 0**: **17 test files/103 tests PASS**, all builds/code-quality PASS, all local Chrome+PostgreSQL and offline PWA PASS, zero prod-only advisory findings and clean PostgreSQL shutdown. PWA preview without backend emitted expected proxy ECONNREFUSED diagnostics but its explicitly unauthenticated offline shell PASS.
- Updated `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`, STATE and START_HERE/implementation handoff for 103 current tests and new browser evidence. Remains NOT Gate-accepted: secure owner reauth after cold offline reload, storage quota/eviction, G8 encrypted off-host DB restore drill, G1 security, dev-tool advisories, exact commit CI/human approval. No commit/push/merge or production/Linux/SSH access.

## 2026-10-13 — Unified execution roadmap after explicit overall-plan request
- Recovered current D-local `.chatgpt/STATE.md`, inspected actual `feat/g5-online-sync` HEAD `2cae801` and dirty tree, and compared origin. Re-read `V2_MASTER_PLAN.md`, `V2_IMPLEMENTATION_PLAN.md`, product decisions, architecture, security/isolation audit and latest G6/G7/G8 test evidence. Identified stale 2026-10-12 master table claiming G2–G9 NOT STARTED and deprecated Muse/OpenCode instructions.
- Added `docs/V2_ACTIVE_MASTER_PLAN_20261013.md` as the proposed *current execution roadmap*: factual Gate G0–G9 status, target MVP, phased priorities (A protect/review local tree; B G6/G7 quality/privacy/offline; C G8 offsite DB disaster recovery; D G1 SSH/isolation; E reviewed CI/staging/G9), explicit dependencies, test commands, acceptance thresholds, and operations requiring separate human authorization.
- Cross-linked active plan from the old master (marked historical), `START_HERE.md`, `V2_IMPLEMENTATION_PLAN.md`, and `.chatgpt/STATE.md`. The new document is a plan, not approval to commit/push/merge/deploy or modify Linux production.
- No application feature changes, no Git commit/push, no production/SSH/DB/host action. QA baseline remains 103/103 local tests and real G6–G8 E2E PASS. Read back documents and Git HEAD to persist this planning checkpoint.

## 2026-10-13 — Actual DayFlow V2 local Windows deliverable, portable package and real user flow
- Restored STATE/ROADMAP/JOURNAL/LESSONS and D dirty Git HEAD `feat/g5-online-sync` `2cae801`. User explicitly requested a usable product. Work confined to Windows D repo, no commit/push/main/Linux/production.
- Created `START_DAYFLOW_LOCAL.bat`, `scripts/start-local-preview.mjs`, npm `demo:local` and `demo:smoke`. The local preview serves **production-built React/PWA assets** and real authenticated Fastify API with **persistent localhost-only PostgreSQL 17** test database (`127.0.0.1:55434`, named `dayflow_test_local_preview`), via web `http://127.0.0.1:5180`. First start creates randomly generated ignored local-only test credentials, a demo account and five Vietnamese sample tasks. Startup refuses external DATABASE_URL and production mode, checks port collisions, and stops services gracefully.
- First startup exposed Windows PostgreSQL default WIN1252 encoding (could not insert Vietnamese task title). Added PostgreSQL `--encoding=UTF8 --locale=C`, verifies server encoding on reuse, and **preserved** original failed demo cluster as `.artifacts/dayflow-local-preview/postgres-data-WIN1252-initial` instead of deleting data. UTF8 app E2E PASS.
- Reproducible Chrome smoke `npm run demo:smoke`: login, seeded Vietnamese tasks, create/reload persistence verified in PostgreSQL, Calendar month on desktop/390px mobile, Settings screen, screenshots and clean DB shutdown ALL PASS. Second and third runs reused **the same persisted PostgreSQL cluster** and PASS. One-click `START_DAYFLOW_LOCAL.bat --smoke` also PASS.
- Wrote `docs/DAYFLOW_LOCAL_PREVIEW.md` with one-click instructions, local credentials path, preserved data, test commands, known security/release blockers and screenshots under ignored `.artifacts`.
- Created `scripts/package-local-preview.mjs`, npm `demo:package`, ZIP `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip` containing source/build/launcher/docs but NO node_modules, .git, .artifacts, DB, secrets or login. ZIP content/privacy validation PASS. Independently extracted ZIP into a NEW ignored folder, ran `npm ci`, installed local PG package, ran `npm run demo:smoke`: build + login + persistence + Calendar/Settings + stop all PASS (exit 0) from the portable copy.
- Full repo QA earlier in this slice passed 103 unit tests, format, lint, typecheck, build and production-only dependency audit. After package script addition a separate final QA is still pending. No Gate accepted, staging or production deploy. ZIP is in ignored local artifacts, not GitHub.

## 2026-10-13 — Final portable ZIP reproducibility and live Windows demo confirmation
- Kept current D worktree and HEAD `2cae801` unchanged, with all uncommitted G6–G8 work intact. Portable test extracted ZIP under ignored `.artifacts/portable-validation-20261013`, then used a clean npm dependency install, separate embedded PostgreSQL install and actual `npm run demo:smoke`: Chrome login, UTF8 tasks, create/reload DB, Calendar desktop/mobile, Settings, clean PostgreSQL shutdown PASS.
- Packaging and transfer privacy checked: `npm run demo:package` PASS; ZIP at `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip` verified (412,536 bytes), no `.artifacts/` user DB or credentials, `.git`, `node_modules` or secrets included.
- Independent repo QA initially discovered duplicate 206 tests from collecting the extracted portable copy in ignored `.artifacts/`; fixed `vitest.config.ts` with `exclude: [...configDefaults.exclude, "**/.artifacts/**"]`. Re-ran format/lint/TypeScript/Vitest: **103/103 tests in 17 files PASS**; production-only audit zero vulnerabilities, `git diff --check` PASS (exit 0).
- Finally started `npm run demo:local` on the user's Windows host. Observed `DAYFLOW_LOCAL_PREVIEW_POSTGRES_REUSED=PASS`, `DAYFLOW_LOCAL_PREVIEW_API_AND_AUTH=PASS`, `DAYFLOW_LOCAL_PREVIEW_READY=PASS`. Independent HTTP GET to `http://127.0.0.1:5180/` and `/api/health` returned 200; unauthenticated `/api/auth/me` rejected, no credential printed.
- All launch/docs/code changes remain only on D Windows checkout, no commit/push/main, no Linux/SSH/prod DB/deploy, no human Gate acceptance. Local preview is a usable test product but not secure staging/production.

## 2026-10-13 — Linux PRIVATE staging deployed and independently browser-verified
- User expressly requested Linux deployment. Recovered D-local STATE/JOURNAL/LESSONS and actual dirty HEAD `2cae801`; Windows connected to Ubuntu through verified SSH host key as unprivileged `dayflow-dev` using Git OpenSSH (Windows built-in ssh.exe returned 255). No root credentials used, no production services changed.
- READ-ONLY precheck Ubuntu22.04 x64, Node26/npm11, private dev home 0700, ~99GB free, ~10.8GB available RAM; new loopback ports 5183 UI and 55435 PG free. Ubuntu Desktop Commander device offline but authorized Windows SSH succeeded.
- Rebuilt transferable ZIP for real Linux portability after discovering Windows PowerShell ZIP backslash members; Python stdlib ZIP writer now normalizes POSIX / paths and checks for secrets/unexpected entries. New SHA-256 `2f1aacd9f96789f063adf5444f89ec1fa7b297c91949618eee412e7c6a6b1390` verified after SCP. First malformed ZIP and partial release preserved (no overwrites). Local Prettier/ESLint/TypeScript/103 unit tests/build and ZIP privacy check PASS before transfer.
- Installed source/build under `$HOME/dayflow-staging/releases/20261013-2f1aacd9` via `npm ci --ignore-scripts`; current symlink and private shared artifacts created only under `dayflow-dev` home. Linux TS/Vite build PASS.
- PostgreSQL bundled Linux binary initially missing libicuuc.so.60, traced to omitted symlink hydration after npm install with disabled scripts; `libicuuc/libicui18n/libicudata.so.60.2` existed within isolated npm package. Created just 3 soname symlinks under local bundled lib, `ldd` PASS. No system package, sudo, Docker, Nginx, firewall, SSH, prod DB, DNS or proxy modification.
- Detached staging started at Linux `127.0.0.1:5183` + PG `127.0.0.1:55435`, owner demo credentials only in private stage file (600). Fresh SSH health200/anonymous401/loopback-only/PID persistence PASS. Windows Git SSH tunnel to `http://127.0.0.1:5183` HTTP200, API200, anonymous denied. Local login copied via encrypted SCP into Windows `.artifacts/deploy` only; never printed in conversation or committed.
- Real Chrome E2E through tunnel PASS for login, Vietnamese seeded tasks, online create/reload, offline queue/reconnect/reload, Calendar desktop/mobile, Settings, and deletion of test fixtures. Scoped stop/restart: Node and Postgres ports released; no postmaster.pid; Node stop marker absent, so do NOT claim that log marker PASS. Logs and PID archived, same Postgres data reused (POSTGRES_REUSED=PASS), **real Chrome E2E PASS again after restart**. Final fresh SSH loopback/health/secrets600 checks PASS.
- Runbook `docs/DAYFLOW_LINUX_STAGING_20261013.md`. Windows ignored connector `.artifacts/deploy/CONNECT_DAYFLOW_LINUX.bat` and test login file; stage process currently remains live and the SSH tunnel was launched. No automatic restart after Linux reboot, no public URL/TLS and no Gate G9 acceptance. G1 root-key/isolation + G8 offsite database recovery still BLOCK public production release.
- Never commit/push/merge `main` or use old GitHub HEAD as the deployed bundle; Linux staging release is the verified ZIP of local dirty tree. Git state and checkpoint require readback before later changes.

## 2026-10-13 — Linux staging deployment closeout, latest independent evidence
- Recovered checkpoint and verified D Git status: branch `feat/g5-online-sync`, HEAD `2cae8015f69718bbaa857c9b0affff18f4c45d7c`, dirty source remains intact, origin feature HEAD unchanged. No commit/push/main merge.
- Post-implementation local full QA chain `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm audit --omit=dev --audit-level=moderate && git diff --check` exited 0: 103/103 tests in 17 files PASS, build and checks green, zero production dependency advisories. Linux build and private Chrome staging end-to-end tests after DB restart already PASS.
- Reread current runbook and STATE. Latest Windows tunneled GET `http://127.0.0.1:5183/` returned 200 and `/api/health` returned 200. Service was live after new SSH session, with test DB and secrets private, loopback-only ports and preserved database across restart.
- Linux instance remains PRIVATE staging, not a public production deployment. G1-A old compromised root key and G1-C dev/prod network isolation not accepted, G8 off-host encrypted DB recovery and G9 public TLS/proxy/CI/staging signoff pending. Nothing changed in existing system Nginx/Cloudflare/UFW/Docker/prod DB; don't claim public release.

## 2026-10-13 — Linux staging continuation: fresh Chrome E2E incl G8 JSON export, DR/client and service audits
- Recovered `D:\projects\dayflow\.chatgpt\STATE.md`, current dirty Git branch/HEAD `feat/g5-online-sync`/`2cae801`, prior JOURNAL/LESSONS and staging runbook. Verified Windows tunnel web+API HTTP 200.
- Real Chrome from Windows through SSH to Linux private staging: login, owner task Unicode, online create/reload, offline create/reconnect, calendar day/month mobile 390px, Settings, **G8 downloaded JSON backup** containing format=dayflow-backup v1, test data and owner Settings, and fixture cleanup. Entire script `.artifacts/deploy/browser-linux-staging.mjs` exit 0, all PASS markers. The downloaded user JSON remained browser-temporary only and was not logged/uploaded.
- Read-only PG tool inventory: PostgreSQL 17 server uses isolated @embedded-postgres binary containing only initdb/pg_ctl/postgres; host pg_dump=14.24 cannot dump newer PG17; postgresql-client-17 missing from current Ubuntu apt cache. No DB dump/restore performed. Created `docs/DAYFLOW_G8_DB_RESTORE_PLAN_20261013.md` with safe PG17 client acquisition, encryption, off-host copy, restore to isolated test DB, integrity checks, Gate blockers.
- Read-only user process inventory: `systemctl --user is-system-running`=degraded, `loginctl dayflow-dev Linger=no`; service therefore cannot be claimed to reboot automatically. Drafted `scripts/dayflow-staging-ops.sh` guarded start/status/stop; local Git sh -n PASS. Attempt to stage remote script was blocked by tool, so did **NOT** install/activate it or touch existing service. Existing staging remains on nohup, loopback and private credentials.
- Appended latest QA and limitations to `docs/DAYFLOW_LINUX_STAGING_20261013.md`; no Git commit/push, Linux root/sudo/system/NGINX/UFW/Docker/production changes, no restart or secrets disclosed. G1-A/G1-C/G8 offhost DR/G9 public release remain open.

## 2026-10-13 — G8 JSON export verified on live Linux staging and post-change QA green
- Extended gitignored Windows Playwright tunnel test to download G8 JSON backup on live Ubuntu staging, parse in browser temporary storage and validate version 1, Unicode seeded tasks, created test fixtures and persisted timezone without logging user task contents. Test cleaned fixtures, all staging UI/online/offline/Calendar cases PASS, **exit 0**.
- Latest D-local `npm run format:check && npm run lint && npm run typecheck && npm test && git diff --check` returned **exit 0 (103/103 tests, 17 files)**. Local `sh -n scripts/dayflow-staging-ops.sh` also PASS; ops file is not installed/activated on Linux after a blocked remote preparation action.
- Added `docs/DAYFLOW_G8_DB_RESTORE_PLAN_20261013.md` (actual blocker PostgreSQL17 native bundle missing pg_dump/pg_restore; Ubuntu client14 incompatible, secure PG17 client/backup/restore drill is NOT DONE) and appended operational findings to `docs/DAYFLOW_LINUX_STAGING_20261013.md`.
- Windows private tunnel and Linux private staging remain accessible; no public production release/host package/root/NGINX/Cloudflare/UFW/Docker changes, no commit or push.

## 2026-10-13 — User approved GitHub push, exact preview host fix verified locally
- Reread D-local STATE/JOURNAL/START_HERE/AGENTS, verified dirty `feat/g5-online-sync` HEAD `2cae801`, origin feature ref same. GitHub connector confirms repo `leuyduc/dayflow` public and account push permission.
- Fixed Vite blocked-host error by narrowly permitting `dayflow.liuduc.site` in `preview.allowedHosts` only; no wildcard/true, no network binding change. New host regression script verifies requested domain HTTP200, localhost HTTP200 and another subdomain HTTP403; targeted production build/Prettier/ESLint/TypeScript PASS. Added CI regression command.
- Public-repo secret audit, full QA, commit, push and exact-sha CI **not yet completed** at this checkpoint. No Linux reload, Nginx/DNS/production changes.

## 2026-10-13 — Entire V2 feature worktree passed pre-push QA and public-repo file screening
- User authorized pushing GitHub branch `feat/g5-online-sync`. Exact Vite preview host allowlist and CI regression added; README active status fixed. Full local chained QA `format:check → lint → typecheck → 103/103 tests → build → preview host positive/negative checks → Chrome/PostgreSQL G6G8 E2E → G7 E2E → PWA smoke → prod dependency audit → git diff --check` PASS, exit 0. Embedded test PostgreSQL instances stopped.
- PUBLIC repo `leuyduc/dayflow` checked with GitHub connector. Read-only scanner enumerated 134 trackable source files and reported zero forbidden .artifacts/credential paths, private-key/PAT signature patterns, symlinks and oversize files (safe .env.example uses placeholders). No broad guarantee beyond these checks.
- PRE-PUSH only: staged file list, commit, push and exact SHA CI still pending; no Linux restart or production change. Vite fix will apply to Linux preview only after an independently authorized release/restart.
