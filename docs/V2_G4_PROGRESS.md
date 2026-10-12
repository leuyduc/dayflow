# DayFlow V2 — G4 Task CRUD Development Verification

Date: 2026-10-12 (Asia/Bangkok)
Branch: `feat/g4-task-crud`
Status: **FUNCTIONAL G4 DEVELOPMENT IMPLEMENTED AND TESTED — GATE ACCEPTANCE PENDING**.
Base: G3 technical acceptance was authorized by the operator for commit `a3074d9`, with production security G1 outstanding.

## Implemented
- PostgreSQL/Drizzle task repository supports owner-scoped `listTasks`, `createTask`, `updateTask` and `deleteTask`.
- Routes: `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`.
- All endpoints require an authenticated, valid server-side session; mutations additionally require the exact configured Origin and per-session CSRF token in `X-Dayflow-CSRF`.
- Zod strict input validation for title, description, priority, date-only dueDate, estimated minutes, tags, status and UUID path. Unknown fields are rejected; invalid dates are rejected.
- Server derives userId **only from the session**, never trusts a client-supplied owner ID. Foreign-owner updates/deletes return 404 without disclosing record existence.
- Mutations require `expectedRevision`. Drizzle atomic `WHERE user_id AND id AND revision AND deleted_at IS NULL` prevents silent overwrite; stale revisions return HTTP 409.
- Deletions are soft/tombstoned (`deleted_at`, revision increment) for future G5 synchronization; deleted items are excluded from normal task lists. Completing/reopening tracks `completedAt`.
- React UI: login and session restore, responsive Today/Tasks navigation, quick capture, search/status filter, edit title/description/priority/date, mark complete/reopen, confirmation before delete, loading/empty/errors/conflict feedback, logout. No token in localStorage.

## Tested independently
- Existing G3 tests still pass; G4 API/memory tests add negative auth, CSRF/Origin, cross-owner access, validation, revision conflict, create/edit/complete/reopen/delete.
- React component tests cover actual UI handlers with a mocked HTTP API; no false claim that mocked backend proves database persistence.
- `npm run test`: 27/27 PASS (unit, API, PGlite, React).
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`: PASS.
- `npm run test:postgres:local`: actual PostgreSQL 17 TCP + Drizzle/pg.Pool + real Fastify HTTP task CRUD including rejection of invalid CSRF/Origin and cross-owner access, stale revision 409, soft deletion/tombstone and cleanup: PASS. This extends existing G3 native-postgres test and also runs in ephemeral GitHub Actions postgres:17 job.
- `npm run test:browser:g4`: actual Chrome headless UI smoke for login/create/edit/complete/reopen/delete/mobile/no JS errors, **with intercepted mocked API responses**: PASS.
- `npm run test:browser`: legacy G2 smoke PASS.
- Exact GitHub Actions commit run and results to be added to ChatGPT journal once independently checked.

## Reproduction
Run `npm ci --ignore-scripts`, `npm run build`, `npm run test`. For local PostgreSQL integration install the **test-only** native binary under ignored `.artifacts/postgres-sandbox/` as described in `docs/V2_G3_LIVE_POSTGRES_EVIDENCE.md`, then run `npm run test:postgres:local`.
For browser UI checks with `dev:web` already running on localhost and Chrome installed: `npm run test:browser:g4`.

## Explicitly not implemented or accepted
- The normal Windows development API instance remains health-only unless started with an isolated configured PostgreSQL database and owner account; the shipped UI is not connected to a persistent real personal account by default. **Do not mistake browser mock success for an existing live personal login.**
- Multi-device synchronization, idempotency/change feed and conflict UI beyond HTTP 409 are G5; offline persistence is G7; calendar scheduling is G6.
- No deployment or Ubuntu modifications, no production DB, migration or credential access; no branch merge into main.
- Formal G4 acceptance, security review and production-readiness are pending. G1-A exposed old root key and G1-C Linux agent isolation remain separate blocking risks. Muse/OpenCode context/cache is independent of ChatGPT-only logs.

## Lessons
- Complete/reopen smoke must use the unfiltered Tasks page: Today hides completed tasks by design. Browser test was corrected accordingly rather than weakening the page filter.
- Enforce owner scope and revision atomically at the SQL update/delete statement, not with only an earlier read.
- Test UI behavior and PostgreSQL persistence separately, label mocked vs real evidence, and verify CI with exact final commit SHA.

## Real browser-to-PostgreSQL G4 verification — follow-up, 2026-10-12

The previous **mock-API browser** and **real-PostgreSQL HTTP API** checks now have a third independent test: `scripts/browser-g4-postgres-e2e.mjs`.

- Uses the native PostgreSQL 17 binary already installed under the gitignored Windows sandbox; no server-global service or Ubuntu access. Generates throwaway DB/user/owner credentials. Starts Fastify and a dedicated Vite development server on loopback, with actual Vite `/api` reverse proxy.
- Real headless Chrome, with **no request mocking/interception**, logs in against the real PostgreSQL-backed Fastify session. It creates a task and verifies the row via SQL, reloads the browser and verifies persisted task/session, edits title/description/dueDate/priority, toggles completed/reopened with SQL verification, deletes and verifies the revisioned tombstone, checks mobile overflow/JS runtime and logs out. Test starts and stops services itself.
- The test supports an external **loopback-only, dedicated `dayflow_test_` database** on an isolated GitHub Actions PostgreSQL 17 service. The new `g4-browser-postgres-e2e` job runs this real end-to-end browser/API/PostgreSQL path independently of the existing G3/G4 test jobs.
- Prerequisites for local Windows run: `npm ci --ignore-scripts`, `npm run build -w @dayflow/api`, install test-only native PostgreSQL wrapper into `.artifacts/postgres-sandbox/` (see G3 evidence), Chrome already installed. Run `npm run test:browser:g4:postgres`. It uses dedicated port `5174` (web) and `55433` (PostgreSQL) in Windows local mode and will fail rather than take over occupied ports.
- **This does not provision a persistent personal DayFlow account**. Test data are disposable. The backend remains guarded against production access. The user must explicitly accept G4 before its Gate is marked PASS and G1 security remains separate.
- First browser smoke attempt timed out at Playwright `networkidle` with Vite; switching to `domcontentloaded` and waiting for actual UI elements fixed the test. Test correctness is based on DOM/SQL outcomes, not network silence.
- CI status is recorded in ChatGPT journal by exact commit SHA, not assumed from the presence of a workflow definition.
