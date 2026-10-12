# DayFlow V2 — Full-stack foundation

This branch (`feat/fullstack-foundation`) contains a tested development scaffold for DayFlow V2. **It is not deployed** and does not yet implement authentication, task persistence, synchronization, or offline edits.

## Architecture
- `apps/web`: React 19 + Vite 7 + Tailwind 4, responsive navigation, API status and component tests
- `apps/api`: Fastify 5 health route with app factory and isolated API injection tests
- `packages/domain`: pure task rules with Vitest unit tests
- `packages/contracts`: shared API contract types
- Root: npm workspaces, TypeScript strict, ESLint, Prettier, Vitest, Playwright Core browser smoke script

## Local setup
Requires Node.js 22.12 or later and npm.

```bash
npm ci
npm run dev:api
# In a separate terminal:
npm run dev:web
```

Web: http://127.0.0.1:5173
API health: http://127.0.0.1:3002/api/health

## Tests and quality checks
```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
```

The suite includes domain tests, Fastify API integration-style tests and React component tests in jsdom.

## Browser smoke test
With `dev:api` and `dev:web` running, execute:

```bash
npm run test:browser
```

This uses an existing local Chrome/Chromium browser through `playwright-core`; it **does not download a browser**. Set `DAYFLOW_BROWSER_BIN` to the executable path if Chrome is installed elsewhere. It checks desktop navigation, API status, mobile navigation, horizontal overflow and JavaScript page errors. Screenshots are saved to `.artifacts/` (gitignored).

## Boundaries
These checks verify **G2 development scaffold only**. No real user authentication, PostgreSQL persistence, task CRUD, sync or offline writes are implemented yet. CI workflow exists, but its independently reported run result must be verified separately before claiming CI passed.

For V2 product and architecture decisions, see `docs/V2_MASTER_PLAN.md` and other `docs/V2_*.md`. The `.chatgpt/` directory is ChatGPT-only continuity and is **not** Muse/OpenCode cache. Do not deploy to live Linux before server security isolation and explicit approval.


## G3 development-only authentication/database preview
The `feat/g3-auth-db` branch adds Argon2id verification, server sessions with HttpOnly cookies, CSRF/origin checks and PostgreSQL schema/migrations. There is **no public registration**. The API only registers authentication routes when `DATABASE_URL`, `DAYFLOW_CSRF_SECRET` (at least 32 bytes) and `DAYFLOW_APP_ORIGIN` are configured together. In production, their absence fails startup.

Check the SQL migration and security tests without installing PostgreSQL or contacting Ubuntu:

```bash
npm run db:generate
npm run test
npm run typecheck
npm run lint
npm run build
npm run format:check
```

G3 tests use a memory repository for Fastify auth behavior and a temporary PGlite PostgreSQL engine for schema constraints. These are **not** real PostgreSQL TCP integration tests.

Only when a dedicated development database has been created on local loopback, inspect `apps/api/.env.example` and explicitly provide environment variables outside Git. Run `npm run db:migrate:dev` and `npm run db:bootstrap:dev` manually, one at a time. Both require `DAYFLOW_DB_ENV=development` and refuse non-DayFlow local DB names or remote hosts; owner bootstrap additionally requires `DAYFLOW_BOOTSTRAP_CONFIRM=YES`. Never use production data or credentials in these tests.

Auth-only routes:
- `POST /api/auth/login` (Origin + rate limit + Argon2id, returns owner profile and in-memory CSRF token, sets HttpOnly session cookie).
- `GET /api/auth/me` (requires session, returns CSRF token).
- `POST /api/auth/logout` (requires session, correct Origin and `X-Dayflow-CSRF` header).
- `GET /api/tasks` (requires session; server-side owner-scoped read-only result). Task mutation/UI is G4.

For checkpoint details and untested integration limits see `docs/V2_G3_IMPLEMENTATION_PROGRESS.md`.

## Reproducible live PostgreSQL integration — G3

For an isolated **Windows development** PostgreSQL 17.10 test without Docker, install the optional binary wrapper only in the ignored sandbox directory:

```powershell
npm ci --ignore-scripts
npm run build -w @dayflow/api
New-Item -ItemType Directory -Force -Path .artifacts/postgres-sandbox
npm install --prefix .artifacts/postgres-sandbox embedded-postgres@17.10.0-beta.17 --ignore-scripts --no-audit --no-fund
npm run test:postgres:local
```

The script generates disposable credentials, binds PostgreSQL to loopback, creates a separate test database, validates migrations and real HTTP-backed session/authorization, then stops the server. No production database is involved. On GitHub Actions, a `postgres:17` CI service runs the same test in external mode with a public test-only credential, separate from the normal lint/build/unit checks.

Evidence and limitations: `docs/V2_G3_LIVE_POSTGRES_EVIDENCE.md`. Do not use the prerelease test wrapper as a production database.

## G4 — Online task CRUD development slice

The `feat/g4-task-crud` branch adds server-authorized online task create/list/edit/complete/reopen/delete, optimistic concurrency via `expectedRevision`, and React task management UI (login, capture, search/filter, edit and delete). The server is still authoritative for persisted data. There is no live account configured by default.

For reproducible verification on Windows development:
- `npm run test`: unit/React/API/PGlite tests.
- `npm run test:postgres:local`: real PostgreSQL 17 + TCP/HTTP CRUD tests (requires the ignored development binary setup documented in `docs/V2_G3_LIVE_POSTGRES_EVIDENCE.md`).
- `npm run test:browser:g4`: real Chrome UI interaction test with mocked API responses (requires dev:web running).
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`.

Mutations require an authenticated cookie and `X-Dayflow-CSRF` header; the browser receives the CSRF token only in the in-memory login/session response. JSON `PATCH` and `DELETE` require `expectedRevision`; stale edits return HTTP 409. Cross-owner access is denied, and deletes create tombstones. UI runs against real PostgreSQL only after a separate development database and owner account have been explicitly configured.

See `docs/V2_G4_PROGRESS.md` for evidence and limitations. G4 does not implement scheduling, offline queues or device sync, and must not be deployed to Ubuntu production before G1 isolation and a reviewed release.

## G4 real browser + real PostgreSQL integration

For development-only E2E testing (not using any production database), ensure Node dependencies and the G3 test-only PostgreSQL wrapper are present in the ignored `.artifacts/postgres-sandbox/` directory (setup in `docs/V2_G3_LIVE_POSTGRES_EVIDENCE.md`). With a previously installed local Chrome:

```bash
npm run build -w @dayflow/api
npm run test:browser:g4:postgres
```

This test starts an isolated PostgreSQL cluster and separate localhost Vite/Fastify servers, then checks actual Chrome login, create, refresh/persist, edit, complete/reopen, delete/tombstone, logout, and direct SQL state with **no mocked network calls**. Services and disposable credentials are cleaned up after the test. GitHub Actions also runs the same workflow with its own ephemeral PostgreSQL 17 container.

See `docs/V2_G4_PROGRESS.md` for evidence and outstanding acceptance/security boundaries.

## G5 online synchronization (development)

Branch `feat/g5-online-sync` adds migration-backed `sync_state`, `change_log` and `processed_mutations`. Authenticated `POST /api/sync/push`, `GET /api/sync/pull?cursor=N` and `GET /api/sync/bootstrap` provide owner-scoped online protocol, commit-safe per-owner cursor and retry idempotency. **Existing G4 online task writes now flow through the same transaction that updates the change log.**

Verify with `npm run test:postgres:local` in the isolated Windows dev sandbox or with the repository's ephemeral PostgreSQL 17 GitHub Actions integration job. A/B sessions, racing edits, duplicate retries, tombstones and per-owner ordering are included in the real PostgreSQL tests.

React now loads a consistent owner snapshot and cursor via `/api/sync/bootstrap`, then receives incremental ordered task changes and tombstones from paginated `/api/sync/pull` on focus, reconnect, manual `Đồng bộ ngay` and a limited timer. An invalid/ahead cursor requests a fresh bootstrap. Edits send versioned `/api/sync/push` mutations with an explicit keep-server/overwrite-after-review conflict choice. Create, complete/reopen and delete retain the existing authenticated REST endpoints, which also emit change log entries. The real browser-to-PostgreSQL E2E also exercises **two independent Chrome sessions** concurrently editing one task, verifies both explicit keep-server and reapply-own-draft choices, and checks the final SQL revision. G7 offline storage/outbox is **not** implemented. G5 human acceptance remains pending. See `docs/V2_G5_PROGRESS.md` for scope and limitations.
