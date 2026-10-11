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
