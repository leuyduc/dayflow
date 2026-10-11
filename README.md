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
