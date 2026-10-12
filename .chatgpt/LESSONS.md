# DayFlow V2 — ChatGPT Lessons Learned (append only)

**Applies only to ChatGPT's coordination and recovery, not Muse/OpenCode context or cache management.**
Capture concrete mistakes/causes/preventive checks; no need to invent a lesson if none arose.

## 2026-10-12 — Never trust plan status without live verification
Observed: Linux carried many existing services, open listening ports and container workloads. It was not an empty VPS.
Lesson: Audit real service/port/resource state before proposing any installs or port allocations; never treat documentation as live evidence.

## 2026-10-12 — SSH host identity before enabling automation
Observed: SSH host fingerprint was checked against a trusted Linux console before strict host-key login.
Lesson: Never use `StrictHostKeyChecking=no` or blindly add unknown host keys. Separate operator SSH root key from developer SSH key.

## 2026-10-12 — Avoid brittle shell transport and validator assumptions
Observed: PowerShell-to-SSH quoting/CRLF and interpretation of `sshd -T` multi-value `allowusers` caused aborted checks/rollback despite a valid proposed SSH configuration.
Lesson: Prefer minimal, inspectable scripts with explicit exit codes; parse tool output semantically rather than relying on a single exact string; verify effective policy and service health before/after every modification. Errors must be reported; rollback should preserve access.

## 2026-10-12 — Partial gates are not full security acceptance
Observed: Account creation and fresh SSH login succeeded, but negative privilege tests were blocked and an exposed old root key remains authorized.
Lesson: Mark G1-B PARTIAL, G1 overall NOT PASSED, and prevent autonomous Muse from accessing production even if developer account login works.

## 2026-10-12 — Distinguish ChatGPT context from Muse context
Observed: ChatGPT conversation/runtime context can be lost or compacted; Muse runs in OpenCode, which manages its own session/context.
Lesson: Store checkpoint, journal and lessons in `.chatgpt/`; each ChatGPT session rereads the concise state and verifies live progress. **Do not impose repeated full-document reads or external cache synchronization on Muse**, and do not spend Muse tokens on ChatGPT recovery.

## 2026-10-12 — Account permissions are not network isolation
Observed: `dayflow-dev` lacked sudo/docker group privileges, yet TCP handshakes to three existing host loopback services succeeded. No database authentication or secret reads were attempted.
Lesson: Never treat a dedicated Unix user or Docker socket DAC mode as sufficient for running autonomous code beside production. Require verified namespace/VM boundaries, explicit egress restrictions and deny-access tests before agent execution; distinguish TCP reachability from data access.

## 2026-10-12 — Blocked negative tests cannot be claimed successful
Observed: remote tool safety policy blocked direct sensitive-file permission probes, though filesystem modes could be inspected safely.
Lesson: Record access-denial tests as BLOCKED/UNVERIFIED and base recommendations on what was genuinely observed. Do not bypass tool safety controls just to manufacture a PASS.

## 2026-10-12 — Device access is not agent isolation
Observed: Direct Remote Desktop Commander Linux pairing could simplify access, but the G1-C audit already demonstrated a dev account could reach localhost services; an attempt to launch the pairing remotely was blocked by platform safety controls.
Lesson: Pair devices only with explicit operator verification, do not circumvent tool blocks, and do not confuse remote MCP terminal access with a production-safe code-execution sandbox. Keep read-only audit and broader agent permissions separately gated.

## 2026-10-12 — MCP online is not shell-access proof
Observed: Ubuntu remote device advertised Online and responded to ping, but direct read-only `whoami` and `pwd` execution were blocked by platform safety checks.
Lesson: Distinguish device registration, transport health, actual shell execution and authorization as separate checkpoints. Do not claim Linux user identity verified merely from a device name or an earlier SSH session, and do not bypass execution policy.

## 2026-10-12 — Model discovery is not a successful model invocation
Observed: OpenCode displayed Muse Spark 1.3 in its model list, but a deliberately minimal model invocation did not produce output and remained waiting until the test process was terminated.
Lesson: Check provider/model availability using a bounded harmless smoke test before delegating development. Treat non-responsive sessions as unverified; do not report Muse as working just because the model name appears. Never conflate MCP Online, file access, shell access and model inference.

## 2026-10-12 — Parallel progress is possible without touching production
Observed: G1 Linux agent isolation remained unresolved, but the DayFlow web/API foundation was developed and actually verified on the separate Windows workstation and GitHub feature branch.
Lesson: Do not make all coding progress contingent on production-server setup. Use a clean feature branch and safe local development, with strict prohibition on deployment until Linux safety gates pass. Track off-server scaffold success separately from G1/G2 formal acceptance.

## 2026-10-12 — Use dependency lockfile and check plugin compatibility
Observed: Initial web typecheck/build failed due to Vite 6 workspace version coexisting with Vite 7 plugin types. Aligning to Vite 7, regenerating lockfile and rerunning the full checks resolved the issue.
Lesson: Resolve npm dependency versions before trusting typecheck/build, retain a lockfile and verify actual commands. Limit Prettier to new source rather than rewriting historical design documents simply to pass a style gate.

## 2026-10-12 — Turn passive API and UI smoke tests into reproducible checks
Observed: A successful local API response/HTTP 200 did not cover navigation behavior, offline state or real mobile layout. Fastify injection tests, React Testing Library and Playwright Core (with installed Chrome) verified these with 10 unit/component/API tests plus desktop/mobile browser smoke.
Lesson: Prefer testable app factories and repeatable browser smoke scripts over manual claims. Keep screenshots local and ignored when not intended for publication; track independent CI separately from local green tests.

## 2026-10-12 — Commit hygiene and remote reconciliation
Observed: Git's staged whitespace check caught a README trailing-space issue before commit. After committing, GitHub rejected push because a documentation-only commit had been added remotely since local clone.
Lesson: Correct whitespace rather than bypassing QA; on non-fast-forward rejection, fetch and inspect remote-only commits/changed files, then rebase/merge safely. Never force-push merely to advance a milestone. Always verify local/remote synchronization and record the final commit SHA.

## 2026-10-12 — Confirm independent CI by commit, not by missing status widgets
Observed: GitHub connector combined commit status and PR-scoped runs returned empty, but the repository's public GitHub Actions runs API showed an actual completed/successful workflow for the specific pushed SHA.
Lesson: An empty status list is not proof that CI did not run. Verify workflow run by exact commit SHA and record link/conclusion, while keeping local tests, CI and gate acceptance separate.

## 2026-10-12 — Test generated SQL without touching shared databases
Observed: the development Windows host had neither Docker nor a PostgreSQL server. Drizzle successfully generated SQL, and PGlite independently executed migrations and enforced PostgreSQL constraints in an ephemeral in-memory database.
Lesson: A PostgreSQL-compatible embedded engine is a useful safe *intermediate* test for schema/migration code, but it does not verify the separate TCP `pg.Pool` adapter or real PostgreSQL deployment. State this boundary explicitly and retain a required live isolated-Postgres integration gate.

## 2026-10-12 — Fail closed and guard development database commands
Observed: the G3 authentication API could be tested with an injected in-memory AuthStore, while separate development-only migration/bootstrap utilities were created with loopback, DB-name and environment-marker guards.
Lesson: Separate security-critical business logic from persistence, do not register auth endpoints when required configuration is absent, and never automatically migrate/create accounts on an unverified database. For new endpoints, cover unauthenticated, wrong Origin, bad CSRF, expired/revoked session and owner scope.

## 2026-10-12 — Full CI proof follows the exact G3 SHA
Observed: local lint initially caught an unused PostgreSQL import, corrected before commit. GitHub Actions completed SUCCESS on the pushed G3 commit.
Lesson: Re-run all checks after fixes, verify CI by exact commit SHA, distinguish schema/fake-store test success from real DB integration, and record the original failure/fix so the next ChatGPT session can resume without repeating work.

## 2026-10-12 — Real PostgreSQL testing without global DB installation
Observed: A temporary native PostgreSQL cluster was started from an ignored per-project Windows development sandbox, connected to through the actual TCP driver, and stopped cleanly. Schema-only PGlite tests were insufficient to prove pg.Pool, migrations and session behavior.
Lesson: Isolate native integration test binaries/data, generate credentials per run, bind to 127.0.0.1, test cleanup/no remaining listener, and clearly separate dev tests from production configuration. Never point database tests at shared Ubuntu services to save setup time.

## 2026-10-12 — Migration replay, one-owner invariants and real HTTP tests
Observed: Replaying the generated Drizzle migration was idempotent; attempting a second owner bootstrap was blocked; a real Fastify HTTP listener with PostgreSQL-backed cookie session enforced owner-only task reads and CSRF logout.
Lesson: Test the whole auth boundary from HTTP through session to PostgreSQL, including negative/replay cases, not merely isolated repository mocks. Disposable fixtures may include a second account to validate tenancy isolation without enabling public registration.

## 2026-10-12 — Verify Linux CI Postgres job separately from local tests
Observed: GitHub Actions run 38166399632 had two completed SUCCESS jobs: general checks and the PostgreSQL 17 service integration. The exact `npm run test:postgres:ci` step succeeded.
Lesson: CI needs an independent ephemeral database service with test-only credentials and no production access. Require the exact SHA/job/step status; leave operational acceptance to the user and never equate technical CI success with permission to deploy.

## 2026-10-12 — Keep authenticated CRUD authorization at the SQL boundary
Observed: G4 tasks include `userId` filters and conditional `revision` for every edit/delete, reject foreign-owner IDs as 404 and stale edits as 409; soft deletions retain a tombstone for G5.
Lesson: Never trust client-supplied owner IDs and never rely on a preliminary SELECT for concurrency control. Require owner and expectedRevision predicates in the actual UPDATE/DELETE, verify session+CSRF/Origin for every mutation, and test negative cases against real PostgreSQL.

## 2026-10-12 — UI fixture views and regression tests must match semantics
Observed: Chrome test tried to reopen a completed task on Today, but Today correctly excluded completed records and the test waited until timeout.
Lesson: Test complete/reopen on the Tasks/All view, where completed items are visible. Preserve intentional product filters rather than changing UX merely to make smoke tests pass; test mobile overflow and app runtime errors separately.

## 2026-10-12 — Surgical edits require immediate typecheck and complete reruns
Observed: An edit to add `tasks` in server auth configuration accidentally altered the Origin/CSRF fields; TypeScript caught it. A mock injection helper needed an explicitly typed payload/async return to avoid the wrong TypeScript overload, and lint caught an unused import.
Lesson: Inspect targeted diffs after edits to security config, fail fast with typecheck/lint and then rerun real database and browser workflows. Record the failure and specific fix before claiming PASS.

## 2026-10-12 — Distinguish React browser mocks from end-to-end real DB verification
Observed: Chrome verified frontend login and task interactions with intercepted mocked API responses, while separate real Fastify HTTP tests exercised PostgreSQL 17 persistence and authorization. Neither single test alone proves every browser-to-database integration path.
Lesson: Report both testing boundaries explicitly; an operator preview requires its own isolated configured database and approved local account. G4 technical success does not mean production readiness or resolve G1 risks.

## 2026-10-12 — Build a full browser-to-PostgreSQL test, not two isolated halves
Observed: G4 already had a mocked browser UI test and a separate real HTTP/PostgreSQL API test, but neither covered a browser's actual cookie, Vite proxy, persistence over reload and SQL state in one session. A new isolated local test verified all layers without request mocks.
Lesson: Before accepting a functional milestone, test the full user path end-to-end with disposable credentials and an isolated DB, and query SQL to confirm writes/tombstones. Keep a separate independent CI path with a throwaway database and never confuse it with a permanently configured personal account.

## 2026-10-12 — Vite development can prevent Playwright networkidle
Observed: A real Chrome navigation stalled until Playwright's 30-second network-idle timeout when using a live Vite development server; initial test failed even though cleanup worked. `domcontentloaded` followed by explicit UI assertions made the test reliably pass.
Lesson: For development servers with HMR/websocket/network activity, wait for semantic DOM and API-driven state, not total network inactivity. Record an initial failure/fix and re-run the whole target scenario.

## 2026-10-12 — G5 cannot be inferred from G4 revision columns
Observed: G4 has owner-scoped `revision` and tombstones, but the schema has no transactional change log, processed mutation IDs or commit-safe per-owner cursor.
Lesson: Never claim multi-device synchronization on the strength of ordinary CRUD. Before G5, plan a serialized-per-owner transactional writer, idempotency ledger and ordered change feed with tests for two clients, retries and out-of-order transactions; G7 offline queue remains separate.

## 2026-10-12 — Browser/database E2E must be independently repeated on CI
Observed: the G4 integration was successful on Windows with native PostgreSQL, and GitHub Actions run 38195148862 separately passed its `g4-browser-postgres-e2e` job on a Linux runner with ephemeral postgres:17 and preinstalled Chrome.
Lesson: Record exact source SHA, workflow run, job and test step. A local browser/DB PASS plus a Linux CI browser/DB PASS is stronger than isolated frontend mocks, but neither substitutes for operator acceptance or production security gates.

## 2026-10-12 — Single-branch clone can hide later feature branch tracking
Observed: a G2 `--single-branch` clone had a narrow `remote.origin.fetch`, so new G4 remote branch tracking was absent even after successful push; ordinary `git fetch origin` did not create that tracking ref.
Lesson: On subsequent feature branches inspect `git config --get-all remote.origin.fetch` and `git branch -vv`. Restore a wildcard fetch refspec only in the local checkout, fetch and set upstream, then compare exact HEAD/origin SHA. Never treat lack of a tracking ref as proof of remote data loss.
