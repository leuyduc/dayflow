# DayFlow V2 — ChatGPT Operator Checkpoint

## IN_PROGRESS — G5 React incremental pull/bootstrap client (2026-10-12)

- Approved development scope: isolated Windows G5 only, G4 technically accepted; G5 Gate NOT accepted, G1 production blocked. Direct ChatGPT coding.
- Code branch and clean baseline: `feat/g5-online-sync` at `c384f977b1710185b6a1c7963f71eeb4b2e4bacc`, CI 38198257304 3/3 PASS, draft PR #2 OPEN; preserve concurrent changes.
- Objective: React first login uses authenticated `/api/sync/bootstrap` and online manual/focus/reconnect/interval refresh consumes ordered `/api/sync/pull` deltas including tombstones and pagination; no G7 offline outbox or production work.
- Acceptance: existing 30+ Vitest, browser mock, Chrome/PostgreSQL E2E, Postgres A/B regression, typecheck/lint/build/format plus new delta tests; verify exact final GitHub CI.
- NEXT ACTION: implement client delta slice on Windows, test locally, push safe commit, checkpoint and READ BACK GitHub STATE plus source HEAD.
- Recovery: verify working tree before modifying and compare to `c384f97`; do not overwrite newer HEAD; if blocked record failure without claiming PASS.

## G5 client edit-conflict slice — LOCAL AND INDEPENDENT CI PASS / GATE NOT ACCEPTED (2026-10-12)

- Protocol: `chatgpt-direct-v1`, implemented directly by ChatGPT, no Muse/OpenCode; source branch `feat/g5-online-sync`.
- Verified source commit: `c384f977b1710185b6a1c7963f71eeb4b2e4bacc` (pushed; Windows checkout clean and same as origin).
- Delivered: React EDIT writes through authenticated `POST /api/sync/push`; on revision conflict the UI keeps the unsaved draft and shows current server version. Explicit user choice keeps the newer server edit or resubmits the user's draft against the displayed revision with a NEW UUID. No silent overwrite and no durable offline queue.
- QA locally: typecheck PASS; ESLint PASS; Vitest **30/30 PASS**; production build PASS; Prettier PASS; real Chrome→Fastify→PostgreSQL end-to-end PASS (after enabling the sync route in the E2E test harness); Chrome mock smoke PASS; PostgreSQL 17 two-device A/B sync integration PASS; diff --check PASS.
- First real browser E2E failed because the pre-G5 test harness did not register `sync` in the Fastify auth options; corrected, reran all browser/Postgres steps PASS. First new component-test assertion had duplicate matching titles, fixed with a multi-element query and rerun PASS. The historical failures are documented, not hidden.
- Independent GitHub Actions for exact source SHA `c384f977b1710185b6a1c7963f71eeb4b2e4bacc`: run `38198257304` completed SUCCESS. Three jobs SUCCESS: `checks` (typecheck/lint/Vitest/build/format), `online-sync-postgres-integration` (real PostgreSQL test step), and `g4-browser-postgres-e2e` (real Chrome/PostgreSQL browser step). https://github.com/leuyduc/dayflow/actions/runs/38198257304
- Draft review PR #2 created: https://github.com/leuyduc/dayflow/pull/2, head `feat/g5-online-sync` SHA `c384f977b1710185b6a1c7963f71eeb4b2e4bacc`, base accepted G4 `feat/g4-task-crud` SHA `655d15e`. DRAFT/OPEN, NO MERGE. Review includes QA evidence and explicit remaining G5 gaps.
- Next safe implementation step (within already approved Windows-only G5 scope): integrate incremental sync pull/bootstrap into React client and add tests while preserving non-destructive edit conflicts. Before next step re-fetch STATE + live G5 branch SHA; G5 Gate acceptance remains pending.
- Gate status: G5 PARTIAL / NOT ACCEPTED. Browser delta-feed consumption and broader conflict paths still remain. G1-A/C security still BLOCK production; no Ubuntu, `main` or release modifications.

## ACTIVE WORKFLOW — ChatGPT Direct Execution (2026-10-12)

- **Sole implementer:** ChatGPT handles planning, code, QA and GitHub operations directly. **Muse/OpenCode is removed** from DayFlow's active workflow; historical mentions below are non-operative.
- **Persistence invariant:** BEFORE and AFTER **every logical step**, re-fetch repo STATE + working feature HEAD; after the step commit a fresh STATE/JOURNAL checkpoint and **READ BACK** committed STATE and HEAD before continuing. Do not rely on ChatGPT conversation cache. Contract: `docs/CHATGPT_EXECUTION_PROTOCOL.md`.
- **Current workflow migration:** COMPLETE for the authoritative V2 design branch: protocol, `AGENTS.md`, `START_HERE.md`, `.chatgpt/README.md`, master plan, architecture, product decisions, implementation and security references updated. Direct coding remains subject to human Gate scope; no production or G5 acceptance implied.
- **Gate truth:** G0 audited; G1 security blocked (old root key and network isolation), old G1-D Muse setup retired; G2 QA verified/formal open; G3 technically accepted; G4 technically accepted; G5 code `4f75f7a` passed CI but gate pending; G6–G9 not started.
- **Next safe step:** For the next explicitly scoped coding task, recover this STATE + current G5 feature HEAD first, review G5 remaining UI/QA and operator acceptance; ChatGPT implements directly on a safe feature branch, then checkpoints/read-backs after EACH logical step. G1 security remediation requires its own approval.
- **Do not:** overwrite concurrent G5 changes, force-push, merge `main`, deploy, touch Ubuntu services, security configuration, production database or credentials.

Updated: 2026-10-12 (Asia/Bangkok)
Owner of this checkpoint: ChatGPT direct implementer; no Muse/OpenCode delegation.
Working repo: `leuyduc/dayflow` (public).
Working docs branch: `design/linux-fullstack-v2`; default `main` untouched by design/G1 work.
Master plan: `docs/V2_MASTER_PLAN.md` (consolidated architecture, G0–G9, G1 critical path, evidence and risk register).
DO NOT put credentials, private key text, internal infrastructure addresses or production data here.

## Goal
ChatGPT directly implements DayFlow React web, Fastify API, PostgreSQL-backed tasks and synchronization in approved isolated development. No Muse/OpenCode. Preserve original task/calendar/planner UX and isolate development from production.

## End-to-end Gate status (always review all rows before new work)
| Gate | Current status | Notes |
|---|---|---|
| G0 — Linux audit | AUDITED | Ubuntu Linux host, existing production services, Docker, Nginx, Node present; OpenCode not found in root PATH as of audit; capacity and isolation risk noted |
| G1 — SSH, identity, isolation, OpenCode | IN PROGRESS / OVERALL NOT PASSED | See substeps below |
| G2 — Full-stack foundation | QA EXPANDED ON WINDOWS / GATE NOT ACCEPTED | `feat/fullstack-foundation` at `920fa74`: React/Fastify scaffold; 10/10 tests, lint/typecheck/build/format PASS; real Chrome desktop/mobile smoke PASS. GitHub Actions successful for exact SHA 920fa74; no Linux deployment. See feature-branch G2 QA evidence |
| G3 — Authentication + database | TECHNICALLY ACCEPTED BY USER; PROD SECURITY G1 BLOCKS | `a3074d9` + CI `38166399632`; accepted for development progression, not Ubuntu production |
| G4 — Task UI/API | TECHNICALLY ACCEPTED BY USER / G1 SECURITY STILL BLOCKS PRODUCTION | `feat/g4-task-crud` `655d15e`; 3/3 GitHub Actions jobs PASS; draft PR #1 for human review, no merge |
| G5 — Two-device online sync | DEVELOPMENT QA + CI PASS / GATE NOT ACCEPTED | `feat/g5-online-sync` `c384f97`; 30 Vitest, PostgreSQL A/B, real Chrome E2E PASS, CI 38198257304 (3/3). Incremental delta UI & offline queue incomplete |
| G6 — Calendar + scheduling | NOT STARTED | |
| G7 — Offline queue and PWA | NOT STARTED | |
| G8 — Import/export + DB backups | NOT STARTED | |
| G9 — Staging/production release | NOT STARTED | |

## G1 substeps
| Step | Status | Evidence or concern |
|---|---|---|
| G1-A old root-key revocation | DEFERRED BY USER / SECURITY BLOCKER | Old exposed public key was observed authorized on Linux; new admin key works. Revocation attempt not completed, old key presumed active |
| G1-B restricted developer identity | PARTIAL PASS | `dayflow-dev` uid 1001 created, password locked, private home, user-owned public-key SSH. Fresh Windows→Linux SSH returned `whoami=dayflow-dev`; root fresh login still works. `sshd -t` passed; SSH reloaded; SSH/Nginx/Docker/UFW/Cloudflared active afterward. Full negative permission tests blocked by MCP policy |
| G1-C strong development isolation | AUDITED — NOT PASSED | Fresh dev SSH verified; passive listener inventory and no-payload TCP connections proved reachability to 3 existing loopback services. File-permission negative tests blocked; separate strong isolation and egress controls needed. See `docs/V2_G1C_ISOLATION_AUDIT.md` |
| G1-D historical OpenCode/Muse on Linux | RETIRED FROM WORKFLOW (not PASS) | Operator moved all coding directly to ChatGPT; no installation or delegated agent runtime |
| G1-E root/admin credential separation and sign-off | NOT STARTED | ChatGPT's Windows MCP can still access a root-authorized administrative SSH key, avoid broad agent delegation |

## Tooling / reality at last check
- Windows Desktop Commander connected, Git, Node and OpenCode 1.19.0 available; two OpenCode processes observed. **Muse availability/provider was not verified**; do not claim running Muse.
- Linux SSH via Windows Desktop Commander works with new separate dev/admin keys; SSH host fingerprint was verified by the operator.
- Linux contains existing live workloads; do not modify those as incidental DayFlow setup.
- On GitHub, `docs/V2_G1_SAFE_CHANGE_PLAN.md` and `docs/V2_G1B_EXECUTION_STATUS.md` record plans and evidence.
- This checkpoint is based on recorded observations; always recheck live state before actions.

## Latest planning checkpoint
- 2026-10-12: consolidated full G0–G9 master plan created and cross-checked with current checkpoint. No Linux changes, no new coding authorization, no gate status transition.

## Latest G1-C verified assessment
- 2026-10-12: Linux `dayflow-dev` logged in with separate key, only its own group, not Docker/sudo. Host filesystem/socket modes observed (not file contents), but direct sensitive-access permission checks were blocked; cannot claim negative-access PASS.
- The same user **successfully opened three no-payload TCP connections to existing host loopback services**, including a database-like endpoint. This proves network reachability, not database authorization. Network isolation FAIL until a sandbox/VM and egress policy is implemented and tested.
- No server changes made during G1-C. Details: `docs/V2_G1C_ISOLATION_AUDIT.md`.

## Direct Ubuntu MCP pairing status (2026-10-12)
- User proposed pairing Ubuntu as an additional Remote Desktop Commander device so ChatGPT can target Linux without Windows SSH relay.
- Read-only preflight via verified `dayflow-dev` SSH: Ubuntu has Node.js v26.7.0, npm/npx v11.19.0; developer home is writable, Remote Device not yet paired.
- Attempt to start Desktop Commander Remote Device through Windows MCP→SSH was BLOCKED by tool safety policy. **No installation or pairing was completed. Do not bypass the block**; operator can run the official remote pairing command interactively as `dayflow-dev` and approve OAuth on dashboard.
- Direct MCP pairing improves access but **does not fix G1-C failed network isolation**, so no autonomous Muse/production access is authorized.

## Direct Ubuntu MCP verification (2026-10-12)
- Remote Desktop Commander device list NOW confirms `ubuntu-server` ONLINE (v0.2.52) alongside Windows device ONLINE.
- Direct Ubuntu MCP `ping` returned pong (transport online).
- Direct Ubuntu MCP `start_process` attempts for `whoami` and `pwd` were BLOCKED by tool safety checks. Neither command ran, so user identity and current working directory on the newly paired device are **UNVERIFIED**.
- This updates prior "not paired" state: pairing succeeded, but terminal access through this integration is still BLOCKED. Do not claim `dayflow-dev` is the remote MCP process identity simply because earlier SSH used that user.
- No Linux service, config, filesystem or production changes were made in this verification turn.

## Fast-track coding checkpoint — 2026-10-12
- Following operator direction to accelerate, feature branch `feat/fullstack-foundation` created from V2 design docs and real scaffold committed there; code commit `fa73757`, evidence doc follows in branch.
- Windows worktree created under user workspace, npm dependencies resolved with `--ignore-scripts`, lockfile committed. Vite version mismatch fixed by aligning to Vite 7.
- Verified `npm run typecheck`, `lint`, `test` (3/3), `build`, `format:check` all exit 0, plus local API and web HTTP smoke. Git push success.
- Web and API dev servers started on Windows localhost for smoke tests; may still be running at this checkpoint; must check live state on resumption.
- No deployment to Linux, no G1 security pass; Muse inference still not verified. G2 scaffold exists but overall G2 gate NOT ACCEPTED.

## Next appropriate action
Ask operator to approve one of: (preferred) separate VM/host with explicit network restrictions, or a verified rootless isolated container/sandbox with restricted host/LAN egress and no production mounts. First remediate G1-A exposed key before marking overall G1 PASS. Do not install OpenCode, deploy, use root for Muse, grant Docker/sudo, or run Muse autonomously until approved isolation is tested.

## Safety and operator preferences
- ChatGPT keeps a persistent journal and lessons after meaningful actions to survive lost ChatGPT context; each new session reconciles entire G0–G9 overview before selecting next step.
- Muse/OpenCode handles its own context and caches. Do not burden Muse with forced repeated context reads, recaps or duplicated token-expensive documents.
- Human acceptance at each Gate, evidence before PASS, no automatic merge/deploy.

## Connection and Muse smoke check — 2026-10-12
- Both Ubuntu and Windows devices were listed Online; Ubuntu MCP ping responded. Ubuntu MCP metadata and home-directory listing worked, showing /home/dayflow-dev exists with mode 0700; remote agent Linux process identity is NOT established.
- Direct Ubuntu terminal commands are still blocked before execution. Ubuntu config reports /bin/bash default shell and blocked command list; these details do not explain platform-level blocking. Do not circumvent tool safety checks.
- Windows OpenCode CLI 1.19.0 lists Muse Spark 1.3 providers/models, including opencode/muse-spark-1.3-contributor-free. This is model DISCOVERY, not proof that inference works.
- A minimal read-only Windows OpenCode model smoke attempt emitted no output and stayed blocked; only this test session was terminated and a follow-up session list was empty. Model execution remains UNVERIFIED.
- No DayFlow code, Linux services, SSH policy, Docker settings or production data changed. Overall G1 still NOT PASSED, G1-C isolation not remediated, G1-D unstarted.
- Next: resolve direct MCP terminal restrictions through supported app permissions if available; operator approval needed before attempting G1-C sandbox provisioning or Linux OpenCode installation. Lightweight isolated sandbox favored over a full VM only if network egress and production separation are demonstrated.

## Additional OpenCode credential check (2026-10-12)
- Windows CLI `opencode providers list` returned 3 configured credential providers: OpenCode Go, OpenRouter and nvidia-glm. No tokens were read or recorded.
- Retried a harmless one-line inference request against `opencode-go/muse-spark-1.3-contributor` using plan/pure mode. It produced no output during repeated polling, showed a waiting process, and that single test process was terminated.
- Model inference remains BLOCKED / UNVERIFIED. Existing OpenCode sessions and DayFlow repository unchanged. Investigate provider/CLI logs via sanctioned non-secret diagnostics before code delegation; avoid repeated blind invocations.

## G2 QA expansion — 2026-10-12 (latest execution checkpoint)
- Code branch: `feat/fullstack-foundation`. Latest verified code commit **`920fa74`**, pushed to origin. Local working tree clean after successful fetch/rebase; the remote-only commit was an existing G2 documentation addition, integrated without force-push.
- Real Windows development checks: `npm run typecheck` PASS, `npm run lint` PASS, `npm run test` PASS **10/10** (3 domain + 3 Fastify injection + 4 React component), `npm run build` PASS, `npm run format:check` PASS.
- Playwright Core against already installed Chrome: `npm run test:browser` PASS: real desktop navigation/API status, mobile navigation/no horizontal overflow, no JavaScript page errors. Local screenshots saved under ignored `.artifacts/`, not published.
- Fastify app factory separated from server listener for repeatable integration testing; test dependencies and reproducible smoke script in committed npm lockfile.
- **GitHub Actions CI independent result UNVERIFIED** (no statuses surfaced by accessible connector, not proof of absence or success). G2 overall still awaits operator acceptance; G3/real DB not implemented.
- No Linux/production changes, no Muse deployment, G1-C remains unresolved; old exposed root SSH key still requires revocation.
- Latest source evidence: `docs/V2_G2_QA_EXPANSION_20261012.md` on the feature branch. Next: review G2/CI and request scoped approval for G3 only in non-production; continue security remediation separately.

## Independent CI verification — 2026-10-12
- Queried public GitHub Actions runs for exact SHA `920fa74cf5ce50a8f20ffd25f8768978e0cff891`: `dayflow-foundation-ci` run **38163990311** status `completed`, conclusion `success`. URL: https://github.com/leuyduc/dayflow/actions/runs/38163990311 .
- This supersedes earlier `CI UNVERIFIED` statements **for SHA 920fa74 only**. The status is independent GitHub Actions evidence, distinct from local test results. G2 full acceptance remains pending, since DB/migrations/other architectural work and operator gate acceptance are not complete.
- Worktree was clean after rebase and push of feature-branch commit; remaining risk G1-A exposed root key and G1-C Linux agent isolation unchanged.

## G3 authentication and schema checkpoint — 2026-10-12
- User authorized G3 work in separate DEVELOPMENT environment, no production changes. Verified G2 branch `feat/fullstack-foundation` clean at `920fa74` and CI SUCCESS before branching.
- New G3 source branch: `feat/g3-auth-db`; pushed code commit `d97343d7aef1975597bfc8544a70796d1ea1807a`; Windows working tree clean after normalizing tracked CRLF files.
- Implemented Argon2id owner login, SHA-256-hashed random session tokens, HttpOnly/SameSite=Strict cookies (Secure in production), server-stored revocation and expiry, strict Origin checks, HMAC CSRF header for logout, rate limiting, owner-scoped protected task reads. No public signup.
- Drizzle PostgreSQL migration generated for `users`, `sessions`, `tasks`, `settings`. SQL constraints and foreign keys tested in isolated in-memory PGlite PostgreSQL engine. A typed `pg.Pool`/Drizzle store adapter and dev-only migration/bootstrap scripts included.
- Windows dev has NO Docker/psql/PostgreSQL server. Actual PostgreSQL network adapter, live migration, account bootstrap and real DB-backed auth integration **NOT TESTED**; no existing Ubuntu/prod DB used. The G3 status is PARTIAL / NOT ACCEPTED, not "fully done".
- Local quality checks: typecheck PASS, ESLint PASS, Vitest **21/21 PASS**, build PASS, format PASS, Chrome desktop/mobile smoke PASS. Drizzle SQL generated successfully.
- Independent GitHub Actions for exact SHA `d97343d7aef1975597bfc8544a70796d1ea1807a`: run `38165238012` `completed/success`, https://github.com/leuyduc/dayflow/actions/runs/38165238012 .
- G3 evidence on source branch: `docs/V2_G3_IMPLEMENTATION_PROGRESS.md`; no Linux config, production secrets, service, or database changes. G1-A old root key and G1-C isolation remain outstanding.
- Next: commission a separate LOCAL development PostgreSQL service and run real adapter+migration+login/owner isolation tests; separately review security configuration and gate acceptance. Do not deploy G3 to Ubuntu or use live production database.

## G3 real PostgreSQL milestone and independent CI — 2026-10-12
- User asked to continue G3 on isolated development. Read checkpoint, G3 evidence, history and inspected Windows development branch clean at `d97343d`. No Docker/WSL/psql available on Windows; Ubuntu was NOT used.
- Prepared a **temporary local native PostgreSQL 17.10** cluster using development-only Node wrapper/binaries in gitignored `.artifacts/postgres-sandbox/`. Bound only to loopback; distinct `dayflow_dev` role and `dayflow_dev_g3` DB; all credentials randomly generated during tests, never committed.
- Reproducible `npm run test:postgres:local` validates TCP/pg.Pool and Drizzle migrations (four tables), migration replay idempotence, guarded owner bootstrap and rejection of second bootstrap, actual HTTP+cookie login, owner-only task read, CSRF and session revocation; PostgreSQL stops cleanly (port test has zero listeners).
- Windows full checks PASS: typecheck, lint, Vitest **21/21**, build, format, real Chrome desktop/mobile smoke, plus PostgreSQL live integration.
- Code and evidence on `feat/g3-auth-db`, commit `a3074d912ee93bd69e756bb1b943127ea9ddcdfc`, pushed; local working tree clean.
- Independent GitHub Actions at https://github.com/leuyduc/dayflow/actions/runs/38166399632: `checks` = SUCCESS, `g3-postgres-integration` = SUCCESS; explicitly verified the `Run npm run test:postgres:ci` step = SUCCESS against ephemeral `postgres:17` service on Linux runner.
- Evidence: `docs/V2_G3_LIVE_POSTGRES_EVIDENCE.md` on source branch. No PostgreSQL instance persisted, no Ubuntu/production services or user data changed.
- **G3 technically verified locally + in CI; awaiting operator acceptance/security review.** G4 task CRUD not started. G1-A exposed root SSH key and G1-C Linux agent isolation remain unresolved; autonomous Muse/Linux deployment prohibited until remedied.

## G3 acceptance and G4 development checkpoint — 2026-10-12
- User explicitly **accepted G3 technical verification**, grounded in G3 commit `a3074d9` and GitHub Actions run `38166399632`. This acceptance does NOT clear G1-A exposed root SSH key or G1-C insufficient agent isolation; no permission for production deployment or autonomous Linux Muse was granted.
- Started G4 on dedicated branch `feat/g4-task-crud` derived from G3, committed/pushed `b435f4dbfbfb3bb16572b5de5cbb481bbfbcc3fb` to origin; Windows worktree clean.
- Implemented server-owned task CRUD (create, list, patch, complete/reopen and soft-delete tombstones), strict Zod validation, owner-scoped PostgreSQL queries, atomic expectedRevision CAS with HTTP 409, session+Origin+CSRF on all mutations.
- Added React login/session restore and online task workspace with quick capture, search/status filter, edit title/description/priority/dueDate, completion toggle, delete confirmation and error states. The UI is not connected to a personal persistent account unless a separate dev DB and owner are configured.
- Actual Windows development verification: TypeScript PASS; ESLint PASS (one unused import detected and fixed); Vitest **27/27 PASS** (including G4 API+React); build PASS; format PASS; Chrome G2 smoke PASS; Chrome G4 mock-API UI smoke PASS (after correcting test to use the unfiltered Tasks view for reopening completed tasks); real PostgreSQL 17 HTTP G4 create/edit/complete/reopen/delete/owner isolation/revision conflict/soft-delete PASS.
- Existing CI workflow was triggered for G4 SHA; independent run https://github.com/leuyduc/dayflow/actions/runs/38167837603 was still `in_progress` at this checkpoint. Do not mark CI pass until independently observed.
- G4 code and evidence: `docs/V2_G4_PROGRESS.md` in branch `feat/g4-task-crud`. G4 status **development implementation verified locally / gate acceptance pending**. No Ubuntu or production modifications.

## Independent G4 CI verified — 2026-10-12
- Verified GitHub Actions for exact source SHA `b435f4dbfbfb3bb16572b5de5cbb481bbfbcc3fb`: https://github.com/leuyduc/dayflow/actions/runs/38167837603 .
- `checks` job = completed/SUCCESS; `g3-postgres-integration` job = completed/SUCCESS; specifically the `npm run test:postgres:ci` step = SUCCESS. Despite the inherited job name, the tracked real PostgreSQL test script now includes G4 CRUD/authorization/revision/tombstone cases.
- Local Windows tests already verified 27/27 PASS, real PostgreSQL 17 HTTP CRUD PASS, Chrome G4 UI mock smoke PASS, lint/type/build/format PASS. No Linux/prod activity. G4 technically ready for operator review, **not yet formally accepted**, and real browser-to-PostgreSQL persistent account preview is not provisioned.

## G4 browser-to-PostgreSQL E2E checkpoint — 2026-10-12
- At session start re-read this STATE plus JOURNAL, LESSONS, G4 source evidence, MASTER, and G5 sync protocol. Verified Windows repo `feat/g4-task-crud` clean at `b435f4d` and G4 CI 38167837603 SUCCESS. Ubuntu untouched.
- Built a **new real end-to-end** test `scripts/browser-g4-postgres-e2e.mjs`: disposable PostgreSQL 17 on Windows localhost, actual Fastify API + Vite dev proxy + real Chrome, no mocked API. Verified login, create persisted row, browser refresh/session persistence, edit title/description/due date/priority persisted in SQL, complete/reopen, deleted tombstone/revision, mobile layout, no JS errors, logout, database clean shutdown; test exit 0.
- Initial Playwright `page.goto(...waitUntil:networkidle)` timed out with Vite HMR; changed to `domcontentloaded` plus real DOM assertions. Subsequent full browser-to-DB test PASS.
- Full local checks re-ran: 27/27 Vitest PASS, typecheck/lint/build/format PASS, real browser-to-Postgres test PASS.
- Added standalone GitHub Actions `g4-browser-postgres-e2e` service job using throwaway postgres:17 with publicly known TEST-ONLY credentials; added G5 sync design-only preparation note. G4 follow-up feature commit `655d15ee851c965eb1b3483fc8c4fed5cc021c0c` pushed to branch, Windows worktree clean. CI run: https://github.com/leuyduc/dayflow/actions/runs/38195148862 (status pending verification at this checkpoint).
- G4 human acceptance NOT granted. G5 only design preparation, no G5 code; `change_log`, `processed_mutations`, per-owner serial cursor missing in schema. G1-A exposed SSH admin key and G1-C Linux agent isolation unresolved; NO production/Ubuntu changes.

## Independent G4 true-browser/PostgreSQL CI SUCCESS — 2026-10-12
- **Exact** feature source SHA `655d15ee851c965eb1b3483fc8c4fed5cc021c0c` matched GitHub Actions run `38195148862`: status `completed`, conclusion `success`.
- All three jobs completed SUCCESS: `checks`, `g3-postgres-integration`, and new `g4-browser-postgres-e2e`; explicitly confirmed the Chrome availability step and `npm run test:browser:g4:postgres` step both SUCCESS.
- Link: https://github.com/leuyduc/dayflow/actions/runs/38195148862 . This supersedes the earlier “new CI pending” statement for that exact SHA.
- G4 **developer QA + independent full-browser-to-PostgreSQL CI verified**; human Gate G4 acceptance remains NOT GRANTED. G5 design-only document exists; G5 implementation/authorization not started. G1 production safety blockers remain unremediated.

## Final local Git reconciliation — 2026-10-12
- Windows checkout originated from `git clone --single-branch` at G2, so `remote.origin.fetch` only covered `feat/fullstack-foundation`; even after pushing G4, `origin/feat/g4-task-crud` was missing locally and `git status` did not show remote tracking. This was not source divergence.
- Corrected **local checkout Git fetch refspec only** to `+refs/heads/*:refs/remotes/origin/*`, fetched remote refs and set `feat/g4-task-crud` upstream. Verified `git status --short --branch` reports `feat/g4-task-crud...origin/feat/g4-task-crud` with clean worktree, both local/remote `655d15ee851c965eb1b3483fc8c4fed5cc021c0c`.
- No source file, remote branch, or production changes made by this Git tracking correction.

## 2026-10-12 — Resume review and G4 draft pull request
- Reconciled all six remote branches. `main` intentionally contains only LICENSE; full V2 code lives on separate G2–G4 feature branches; G3 was technically accepted, G4 remains pending human acceptance.
- Independently reconfirmed exact G4 HEAD `655d15ee851c965eb1b3483fc8c4fed5cc021c0c` and GitHub Actions run https://github.com/leuyduc/dayflow/actions/runs/38195148862: all 3/3 jobs (`checks`, `g3-postgres-integration`, `g4-browser-postgres-e2e`) SUCCESS, with real Chrome→Fastify→PostgreSQL test step SUCCESS.
- Created draft PR https://github.com/leuyduc/dayflow/pull/1 from `feat/g4-task-crud` into `feat/g3-auth-db` with QA evidence and explicit gates. **No merge, no production/Ubuntu changes, no G4 sign-off and no G5 coding approval.**
- NEXT DEV ACTION: operator reviews and formally accepts G4; G5 implementation requires separate scoped authorization. G1-A root key and G1-C isolation still block production/autonomous Linux Muse. Keep `main` untouched.

## 2026-10-12 — Operator accepts G4; G5 online sync development checkpoint
- Operator expressly APPROVED G4 technical acceptance using commit `655d15e` and GitHub Actions run `38195148862`, and authorized *only Windows development* G5 implementation. Production gates G1-A compromised old root key and G1-C insufficient Muse isolation remain BLOCKED.
- Re-read ChatGPT STATE/JOURNAL/LESSONS, source G5 prep, V2_SYNC_PROTOCOL and master; confirmed Windows `feat/g4-task-crud` clean at `655d15e`, exact CI SUCCESS; branched `feat/g5-online-sync` without changing main/Ubuntu.
- Added Drizzle migration `0001_even_wonder_man.sql` for `sync_state`, `change_log`, `processed_mutations`. Common transaction now serializes *all* G4 and G5 task writes per owner with SELECT FOR UPDATE row lock, compares expectedRevision, atomically updates task + owner cursor + change_log + accepted-mutation ledger. Retries with identical UUID/body return stored result; different body/key reused is rejected.
- Added authenticated, owner-scoped `POST /api/sync/push` (batch up to 25, structured outcomes), `GET /api/sync/pull` (pagination/tombstones/cursor), `GET /api/sync/bootstrap` (consistent snapshot). Invalid Origin/CSRF and client-provided owner IDs are rejected.
- UI now includes online `Đồng bộ ngay`, refresh on focus, tab visible, reconnect and limited interval via /api/tasks (server snapshot). Browser **does not yet consume delta pull/push directly**; offline outbox is G7 and NOT IMPLEMENTED. G5 operator acceptance is NOT GRANTED.
- Windows checks: Vitest **28/28 PASS**, TypeScript/lint/build/format PASS, G4 real Chrome→Fastify→PostgreSQL test PASS, G4 Chrome mock test PASS. Real PostgreSQL 17 G5 A/B sessions, bootstrap, retry idempotency, payload fingerprint, concurrent revision conflicts and cursor ordering, tombstones, foreign owner denial, bad CSRF/input PASS; isolated test Postgres stopped cleanly.
- Code pushed `feat/g5-online-sync` at commit `4f75f7a51ef8bc37d772062490d3b13e2c900d71`; GitHub Actions run https://github.com/leuyduc/dayflow/actions/runs/38196775380 was in progress at this intermediate checkpoint. Source evidence `docs/V2_G5_PROGRESS.md`.
- Found existing DRAFT G4 PR #1 into G3 already documented in repo checkpoint; not merged, edited or superseded. No Ubuntu commands, deployment, production DB or credentials touched. Muse context/cache is managed independently.

## 2026-10-12 — Independent G5 Postgres 17 CI confirmed
- Exact feature SHA `4f75f7a51ef8bc37d772062490d3b13e2c900d71` matched GitHub Actions run `38196775380`, status `completed`, conclusion `success`.
- Three jobs SUCCESS: `checks`, `online-sync-postgres-integration`, and `g4-browser-postgres-e2e`. Verified specifically `npm run build -w @dayflow/api` and `npm run test:postgres:ci` in the sync job were SUCCESS.
- Link: https://github.com/leuyduc/dayflow/actions/runs/38196775380 .
- **Technical development verification passed; user G5 acceptance remains pending.** React uses snapshot refresh and does not yet consume sync delta/push directly; full conflict UI and offline G7 queue are not present. G1 production security blockers still apply; no Ubuntu changes.

## 2026-10-12 — Direct ChatGPT workflow migration COMPLETE (design authority)
- Operator directive: eliminate Muse/OpenCode from work execution; ChatGPT alone implements all future project tasks. GitHub context/read-back after EVERY logical step is mandatory due to transient ChatGPT conversation/cache context.
- Updated `docs/CHATGPT_EXECUTION_PROTOCOL.md`, `AGENTS.md`, `START_HERE.md`, `.chatgpt/README.md`, V2 master/product/architecture/infra/implementation documents and retired G1 bootstrap references on `design/linux-fullstack-v2`. Former G1-D is retired (not PASSED); A/C/E security remains open.
- At this checkpoint design HEAD was `74a0ada1ac780250868950e5330e24831b86e0c7`; G5 source branch HEAD was `4f75f7a51ef8bc37d772062490d3b13e2c900d71` (check again live on resumption). G4 technical acceptance and G5 CI PASS / Gate pending are preserved; no G5 source/code, Ubuntu or production changes in this workflow migration.
- Before any next step, re-fetch current design STATE and target G5 HEAD, verify no concurrent advancement, then after the step commit updated STATE + append JOURNAL and READ BACK both.
