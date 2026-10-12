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

## 2026-10-12 — Fast-track G2 foundation on non-production Windows
- Operator asked to accelerate after prolonged setup. Created `feat/fullstack-foundation` from V2 design branch without modifying `main` or Linux services.
- Authored web React/Vite/Tailwind navigation shell, Fastify API health endpoint, typed domain/contracts package, npm workspaces, lint/format/type/test scripts.
- Downloaded repository on Windows under user workspace. `npm install --ignore-scripts` succeeded. Initial TypeScript/build failed because Vite 6 and Vite 7 plugin versions conflicted; aligned web Vite 7 and regenerated dependency lockfile.
- Verified actual commands: typecheck PASS; lint PASS; Vitest 3/3 PASS; build PASS; scoped format check PASS. API localhost health returned OK, website localhost returned HTTP 200. Browser E2E/CI pipeline not yet confirmed.
- Committed and pushed verified changes (code commit `fa73757`), added CI workflow, lockfile and README; G2 evidence documented in `docs/V2_G2_FOUNDATION_PROGRESS.md` on feature branch.
- No Linux/Muse/production changes; overall G1 still FAIL/DEFERRED security and G2 not formally accepted. This prepares a running foundation, not a finished DayFlow.

## 2026-10-12 — G2 verification expanded to real browser
- At session start reread ChatGPT STATE, JOURNAL, LESSONS, G2 evidence and master plan, confirmed Windows development branch/worktree clean and both Remote MCP devices Online. Reused existing Windows worktree; no Ubuntu actions.
- Refactored Fastify health API into an injectable app factory; added three API tests and four UI component tests. Domain tests retained; **10/10 tests passed**.
- Installed testing-only dependencies under npm workspace using `--ignore-scripts` and updated lockfile. Existing Chrome allowed Playwright Core real-browser smoke without downloading another browser. Desktop/mobile navigation, API status, no horizontal overflow and zero JS page errors all passed.
- Re-ran typecheck, lint, unit/component/API tests, production build and format check: all PASS with exit 0. Reproducible browser script and QA evidence document committed. Screenshots kept outside Git in ignored local artifact folder.
- First commit attempt was correctly blocked by `git diff --cached --check` on one README trailing whitespace; fixed then rechecked. After local commit, push initially rejected due to remote doc-only commit; fetched/inspected ahead/behind, rebased safely and pushed without force.
- GitHub feature branch now at **`920fa74`**, local and origin synced. GitHub Actions check status not independently confirmed; leave UNVERIFIED. G2 scope only, no DB/production changes. G1 isolation/security blockers remain.

## 2026-10-12 — Independent GitHub Actions CI confirmed for G2 QA commit
- Queried the public repository GitHub Actions API for the exact final feature-branch commit SHA `920fa74cf5ce50a8f20ffd25f8768978e0cff891`.
- Run `38163990311` (`dayflow-foundation-ci`) returned `status=completed` and `conclusion=success`; https://github.com/leuyduc/dayflow/actions/runs/38163990311 .
- Independent CI is verified for this SHA. Windows local checks and real-browser smoke also passed. G2 complete production functionality and formal operator signoff remain OUTSTANDING; Linux server untouched.

## 2026-10-12 — G3 development milestone 1: owner authentication and PostgreSQL schema
- Recovered ChatGPT STATE/JOURNAL/LESSONS, read V2 architecture/master/sync specs, checked Git `feat/fullstack-foundation` clean at `920fa74` and exact-commit CI success. Windows Docker, psql and PostgreSQL absent; localhost DB ports unused. No Ubuntu actions.
- Created dedicated `feat/g3-auth-db` from verified G2 branch. Installed Drizzle, node-postgres, @node-rs/argon2, Fastify cookie/rate-limit, PGlite and typings with `--ignore-scripts`, lockfile updated; no credentials read or created.
- Auth implementation: owner-only login (no signup), Argon2id verify, random hashed server sessions with expiration/revocation, secure cookie defaults, rate limit, Origin/CSRF protections, protected owner-scoped task list. PostgreSQL store adapter behind typed `AuthStore`.
- Generated Drizzle SQL migration for 4 tables (`users`, `sessions`, `tasks`, `settings`). Created local-only guarded migration/bootstrap commands refusing remote/prod-looking database URLs. Never ran them against any real DB. PGlite migration constraints and fake-store API auth behavior tested.
- Quality: lint initially flagged unused import in PG adapter; removed import and reran full checks. Final test suite 21/21 PASS (including 6 auth, 3 schema migration, 2 DB guard tests), typecheck/lint/build/format PASS, browser smoke PASS.
- Staged diff checked, committed/pushed `d97343d7aef1975597bfc8544a70796d1ea1807a` to `feat/g3-auth-db`. Remote CI `dayflow-foundation-ci` run `38165238012` completed SUCCESS for that SHA. Windows dev working tree clean.
- Limitations: no real PostgreSQL server/integration, no real owner provisioned, no login UI/CRUD. G3 status PARTIAL NOT ACCEPTED; G1 critical SSH/isolation blockers still open. No production/Ubuntu changes.

## 2026-10-12 — G3 real PostgreSQL integration and independent CI
- Reconciled ChatGPT STATE/JOURNAL/LESSONS and G3 source at `d97343d`; Windows does not have Docker or working WSL/PostgreSQL. Selected a temporary PostgreSQL native Windows binary wrapper installed only under ignored development artifacts, not global Windows services or Linux.
- Inspected package manifest and postinstall symlink manifest, installed `embedded-postgres@17.10.0-beta.17` locally with `--ignore-scripts`. Initial loopback server smoke confirmed real PostgreSQL v17.10 via TCP and clean shutdown.
- Added tracked `scripts/test-g3-postgres.mjs` and npm commands for reproducible verification. Test creates a temporary local DB with generated credentials, runs actual Drizzle migrations twice, rejects duplicate owner bootstrap, tests real pg.Pool/HTTP/cookie/auth/owner isolation/CSRF/logout, and stops PostgreSQL. Verified no test listener remained after completion.
- Extended same script for an external *localhost only* test database, then added `g3-postgres-integration` CI job using ephemeral `postgres:17`. Static CI test-only password is public and applies only within throwaway runner; no real secrets included.
- Full Windows checks PASS: typecheck, lint, 21/21 unit/API/PGlite tests, build, formatting, real Chrome browser smoke, and real PostgreSQL integration. All code pushed on `feat/g3-auth-db` commit `a3074d912ee93bd69e756bb1b943127ea9ddcdfc`; branch clean.
- Independently verified GitHub Actions run 38166399632 and individual `checks` and `g3-postgres-integration` jobs SUCCESS, including `npm run test:postgres:ci` step. See https://github.com/leuyduc/dayflow/actions/runs/38166399632 .
- No changes on Ubuntu, SSH, Docker production, or main. G3 ready for human security/acceptance review; G1-A old root credential and G1-C agent isolation blockers remain, no G4 work yet.

## 2026-10-12 — G3 accepted technically; G4 CRUD implemented on Windows
- Operator approved G3 technical gate specifically with commit `a3074d9` and CI `38166399632`, while explicitly keeping production security blockers G1-A/G1-C open. Re-read ChatGPT STATE/JOURNAL/LESSONS and V2 master context; confirmed G3 branch clean and CI successful.
- Branched `feat/g4-task-crud` from G3 without altering `main` or Ubuntu. Added typed task repository, validated CRUD routes, owner scoping, session/CSRF/Origin protections, optimistic expectedRevision mutation checks, soft deletes/tombstone and completion timestamps.
- Added React login/session UI with create/edit/complete/reopen/delete task behavior, search/filter, responsive styles and error handling. Legacy App test asserting “G3/G4 not implemented” was intentionally updated; browser UI tests added.
- Initial API TS failure arose from a surgical edit mangling the server auth options (Origin/CSRF); repaired explicitly and reran checks. New mock-test helper had an `unknown` payload type that selected the wrong Fastify inject overload; corrected typed payload and async helper. Final typecheck PASS.
- New Chrome smoke initially timed out while trying to reopen a completed task on Today view (completed items intentionally filtered); adjusted test to use all-status Tasks view. G4 Chrome smoke PASS thereafter.
- Final local checks: typecheck PASS, lint PASS after removing unused test import, Vitest 27/27 PASS, build PASS, format PASS, G2 and G4 Chrome smoke PASS, actual HTTP+PostgreSQL 17 CRUD/owner/CSRF/revision/tombstone integration PASS.
- Staged diff whitespace check PASS. Pushed G4 commit `b435f4dbfbfb3bb16572b5de5cbb481bbfbcc3fb`; clean working tree. Independent CI was running at time of entry: https://github.com/leuyduc/dayflow/actions/runs/38167837603 .
- No shared DB, credentials, Ubuntu/production or main changes. UI browser smoke uses mocked API, while PostgreSQL real HTTP test validates API persistence separately. G4 not formally accepted.

## 2026-10-12 — G4 exact-commit independent CI PASS
- Checked GitHub Actions run 38167837603 for commit `b435f4dbfbfb3bb16572b5de5cbb481bbfbcc3fb`: `checks` and `g3-postgres-integration` jobs both completed SUCCESS. Confirmed `npm run test:postgres:ci` step SUCCESS; that script exercises G4 real PostgreSQL CRUD as well as G3 auth.
- Outcome: G4 source pushed and locally verified; independent Linux CI verified. G4 awaits human acceptance, no production deployment or Ubuntu changes.

## 2026-10-12 — Resumed G4 after GitHub context reconciliation; true browser-to-database E2E
- Retrieved the current GitHub ChatGPT STATE/JOURNAL/LESSONS and G4/master/sync specifications first; verified feature SHA b435f4d, exact-commit successful CI and clean Windows working tree. No Ubuntu actions.
- Wrote `scripts/browser-g4-postgres-e2e.mjs`: starts isolated Windows localhost PostgreSQL 17, ephemeral DB and test-only user, migrates schema, seeds Argon2id owner, runs real Fastify+Vite proxy+Chrome. No network response mocks. Script verifies create SQL row, reload retention, edit SQL row, completed/reopened revisions, tombstone deleted row, mobile overflow, logout and clean shutdown.
- First run timed out waiting `networkidle` on Vite; corrected to `domcontentloaded` with real element assertions. Re-ran PASS; full test suite 27/27 and typecheck/lint/build/format all PASS.
- Added independent `g4-browser-postgres-e2e` GitHub Actions job with disposable postgres:17 CI service plus reproducible npm script, updated G4 report/README. Added DESIGN-ONLY `docs/V2_G5_SYNC_PREPARATION.md` to scope G5 safely without claiming it exists.
- Staged whitespace check PASS; pushed new commit `655d15ee851c965eb1b3483fc8c4fed5cc021c0c` to `feat/g4-task-crud`; clean worktree. GitHub Actions run 38195148862 pending exact-job result at initial checkpoint.
- No production keys or DB used, and Ubuntu/main untouched. G4 acceptance and G5 authorization remain pending. G1 security blockers unchanged.

## 2026-10-12 — Independent G4 actual browser-to-DB job verified SUCCESS
- Queried GitHub Actions run 38195148862 and compared `head_sha` to `655d15ee851c965eb1b3483fc8c4fed5cc021c0c`.
- Confirmed all 3 jobs successful: `checks`, `g3-postgres-integration`, and `g4-browser-postgres-e2e`; G4 job's `Check preinstalled Chrome` and `Run npm run test:browser:g4:postgres` steps each succeeded.
- G4's full Chrome/Vite/Fastify/PostgreSQL 17 flow now has BOTH isolated Windows test PASS and independent Linux CI PASS. Source branch untouched after the verified SHA; no human G4 signoff and no production deployment.

## 2026-10-12 — G4 checkout tracking repaired
- Final local/remote check revealed `git clone --single-branch` from earlier G2 had left `remote.origin.fetch` pinned to `feat/fullstack-foundation`; `origin/feat/g4-task-crud` was missing locally despite the remote branch existing and matching published SHA.
- Changed only this checkout's Git fetch refspec to the standard wildcard, fetched, configured G4 upstream, and independently verified clean local/remote SHA equality at `655d15ee851c965eb1b3483fc8c4fed5cc021c0c`.
- No remote force push, source code edit or Ubuntu action.

## 2026-10-12 — GitHub state reconciliation and G4 review packaging
- Reopened current design-branch ChatGPT checkpoint and G4/G5 documents; independently compared source branches and exact commits. Default main still LICENSE-only by design; no merges.
- GitHub Actions run 38195148862 at G4 SHA 655d15e is completed SUCCESS: checks, G3/PostgreSQL integration and full Chrome/PostgreSQL E2E jobs each PASS.
- Created DRAFT PR #1 https://github.com/leuyduc/dayflow/pull/1, G4 feature branch into G3 baseline. PR body documents delivered functionality, CI proof, pending human gate acceptance, G1 production blockers and separate G5 authorization requirement.
- Updated ChatGPT checkpoint on documentation branch to remove stale G4 SHA. No code rewrite, server access, deployment, main merge or gate promotion. Next: human G4 review then independently scoped G5 work.

## 2026-10-12 — G4 technical acceptance followed by G5 transactional sync implementation
- User explicitly accepted G4 technical gate at commit 655d15e and CI 38195148862; security G1-A/G1-C separate unresolved. Read STATE/JOURNAL/LESSONS, G5 prep, sync protocol and master. G4 working tree clean and CI confirmed. An existing draft G4 PR #1 was noted from external checkpoint; not altered/merged.
- Created `feat/g5-online-sync` from G4 on non-production Windows. Drizzle migration 0001 adds per-owner serialized cursor `sync_state`, owner-ordered `change_log`, accepted `processed_mutations` ledger.
- Refactored PostgreSQL G4 create/update/delete to use same row-locked transactional writer as sync push. Added secure /api/sync/push, pull and bootstrap routes with owner-session scope, CSRF/Origin, strict validation, per-op structured conflicts and accepted retry deduplication.
- Extended existing real PostgreSQL test for two authenticated client sessions A/B, repeated UUID, alternative payload rejection, cursor/page ordering, concurrent stale edits (one win/one structured conflict), four racing creates, tombstone pull/bootstrap, second account isolation and negative CSRF/owner-field checks.
- First test suite failed due to `zod .omit()` on an already refined object schema; fixed by deriving a fresh strict patch schema from an unrefined create schema. A surgical auth-test change accidentally removed a comma from `csrfSecret,`; caught by JS syntax/format and corrected. JSONB changed object key ordering, so an idempotency test comparing JSON.stringify was revised to compare actual semantic fields. An older G3 test assuming exactly one task was updated to check ownership instead after G5 created more tasks.
- Final local results: typecheck/lint/build/format PASS, Vitest 28/28 PASS, native PostgreSQL 17 online A/B integration PASS, real Chrome + PostgreSQL G4 E2E regression PASS and UI browser mock PASS.
- React TaskWorkspace adds online-only refresh on focus/visibility/reconnect/interval and manual `Đồng bộ ngay`; does not use delta cursor UI or persist offline edits. README and `docs/V2_G5_PROGRESS.md` explain limits.
- Staged Git diff check PASS; commit `4f75f7a51ef8bc37d772062490d3b13e2c900d71` pushed to `feat/g5-online-sync`; working tree clean. GitHub CI run 38196775380 pending result at initial entry. No main merge or Ubuntu/production changes.

## 2026-10-12 — Independent G5 CI three jobs SUCCESS
- Checked GitHub Actions run 38196775380 for exact SHA `4f75f7a51ef8bc37d772062490d3b13e2c900d71`: `completed/success`.
- `checks`, `online-sync-postgres-integration`, `g4-browser-postgres-e2e` all succeeded. Confirmed `npm run test:postgres:ci` step success, covering A/B, concurrent cursor/idempotency/tombstone PostgreSQL 17 tests.
- This supersedes earlier CI pending, only for the exact SHA. Formal G5 gate and client conflict UX are not accepted/done; no production change.

## 2026-10-12 — Operator removed Muse; ChatGPT now implements directly
- Operator explicitly replaced OpenCode/Muse as DayFlow coder with **direct ChatGPT planning, programming, testing, review and GitHub operations**; required GitHub context re-check and persistent checkpoint after EACH logical step to withstand ChatGPT context/cache loss.
- Found concurrent progress on G5 during workflow audit: `feat/g5-online-sync` `4f75f7a`, G4 human technical acceptance, G5 CI SUCCESS but Gate pending. Adopted up-to-date facts instead of overwriting the shared STATE with an obsolete G4 checkpoint.
- Created `docs/CHATGPT_EXECUTION_PROTOCOL.md`, commit `eb7d2fc` on `design/linux-fullstack-v2`, with mandatory before/after read-back and no Muse handoff.
- Updated top-of-file STATE to mark new sole implementer, retired G1-D and current G5 status (commit `3f4175c`). Legacy journal stays factual history, not active instruction.
- No application code/Ubuntu/production/main modifications. Next: align active README/AGENTS/START_HERE/V2 workflow pointers, then verify persisted checkpoint again.

## 2026-10-12 — Active instructions synchronized for direct ChatGPT coding
- Finished workflow-only edits on `design/linux-fullstack-v2`: created `docs/CHATGPT_EXECUTION_PROTOCOL.md`; rewrote `AGENTS.md`, `START_HERE.md`, `.chatgpt/README.md`; updated master plan, product decisions, architecture, infra security, implementation plan and marked historical G1/OpenCode bootstrap documents retired.
- New rule requires re-reading live repo STATE/feature HEAD BEFORE every logical task; after task, commit checkpoint/JOURNAL and re-read the committed checkpoint and HEAD BEFORE proceeding. ChatGPT is sole code implementer; Muse/OpenCode is no longer in workflow.
- Reconciled concurrent G5 development by another session: `feat/g5-online-sync` at `4f75f7a`, CI PASS, user G4 technical acceptance, G5 not accepted. Did NOT overwrite G5 code, source SHA or Gate status.
- Workflow changes are docs-only; no source code build, Linux operation, root/SSH configuration change, production DB, main merge or deployment. Remaining G1 security blockers unaffected.
