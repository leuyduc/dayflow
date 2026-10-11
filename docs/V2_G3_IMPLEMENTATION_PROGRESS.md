# DayFlow V2 — G3 authentication and PostgreSQL development milestone

Date: 2026-10-12 (Asia/Bangkok)
Branch: `feat/g3-auth-db`
Status: **IMPLEMENTED AND TESTED PARTIALLY; G3 NOT ACCEPTED**.

## Implemented
- Database design in `apps/api/src/db/schema.ts`: `users`, `sessions`, `tasks`, `settings`, with owner foreign keys, enum-like CHECK constraints, unique email/token hashes, positive task duration, revision, date-only deadline, timezone-aware schedules and useful owner indexes.
- Drizzle-generated SQL migration under `apps/api/drizzle/`.
- PostgreSQL adapter via node-postgres/Drizzle with account-scoped task listing.
- One-owner registration only through guarded developer bootstrap script, no public signup endpoint.
- Argon2id password verification; random 256-bit opaque session tokens, SHA-256 hash stored server-side, session expiry/revocation, HttpOnly + SameSite Strict session cookie (Secure in production).
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`; login rate limit; same-origin checks and per-session CSRF HMAC header for logout; `GET /api/tasks` requires session and owner scope (read-only slice).
- Server fails closed for auth in production without database, CSRF secret and origin. In local health-only mode without database config, protected routes are not registered.
- Developer-only migration/bootstrap scripts reject remote database URLs, non-Dev database names, superuser database usernames and missing environment confirmation.

## Verification
- npm install dependency resolution on Windows development workstation succeeded.
- Drizzle Kit generated SQL for 4 tables.
- Vitest owner auth tests use an in-memory repository (not real PostgreSQL): invalid credentials/input/origin, session/cookie/CSRF, expiry, logout, rate limiting and task ownership.
- SQL migration tested against a fresh in-memory `@electric-sql/pglite` PostgreSQL engine. Checks create tables, foreign keys, unique email, non-empty task title, invalid scheduled range/status, date-only semantics, and scoped query filtering.
- General unit/component/API tests continue to verify G2 functionality.
- See final G3 checkpoint in ChatGPT journal for exact command outcomes and CI SHA when published.

## Strict verification limits
- **A running PostgreSQL server was NOT available on the Windows developer machine**; Docker CLI and psql were not installed. No external/Ubuntu database was accessed.
- PGlite uses the PostgreSQL engine compiled to WASM, but does not prove the separate `pg.Pool` network adapter, real Postgres session integration, migrations over a live TCP server, or production performance.
- No actual owner account or password was provisioned on a database.
- Frontend login screen and task CRUD remain unimplemented; G4 follows G3.
- Real Postgres integration tests, migrations on an isolated service, secure auth deployment configuration and operator G3 acceptance remain outstanding.
- No Linux server, production service, existing Docker container, domain, firewall, or user data was changed.

## Local developer commands
Use `npm run db:generate` at repository root to regenerate SQL after a schema change.
Only after creating a **separate localhost PostgreSQL development database** with an unprivileged role and verifying the target, set `DAYFLOW_DB_ENV=development` and a suitable `DATABASE_URL`, then manually run `npm run db:migrate:dev`. To bootstrap one owner, securely provide `DAYFLOW_OWNER_EMAIL` and `DAYFLOW_OWNER_PASSWORD`, set `DAYFLOW_BOOTSTRAP_CONFIRM=YES` and run `npm run db:bootstrap:dev`.
Never use these commands against production or another project's database. Never commit a populated `.env` or database dump.

## Next gate step
Review schema/auth tests and CI; obtain an isolated PostgreSQL service for real end-to-end integration; run negative ownership and migration tests. Keep G1 security remediation independent and **do not** deploy or execute autonomous Muse on Linux until its isolation passes.

## G3: actual localhost PostgreSQL integration (2026-10-12)

**Update to the earlier checkpoint above:** The original environment limitation (no PostgreSQL server) was subsequently addressed by a temporary local Windows PostgreSQL 17 cluster, without Docker or Linux involvement. The actual TCP `pg.Pool`/Drizzle adapter, migration, one-owner bootstrap, HTTP login/cookies, owner task filtering and logout/CSRF/session revocation have now passed. See [V2_G3_LIVE_POSTGRES_EVIDENCE.md](V2_G3_LIVE_POSTGRES_EVIDENCE.md).

A reproducible development-only script now exists at `scripts/test-g3-postgres.mjs`, invoked by `npm run test:postgres:local`. A separate GitHub Actions job uses the same script against an ephemeral `postgres:17` CI service; exact commit status must be independently confirmed before acceptance.

G3 still requires a security review and operator gate acceptance. This improvement does not remediate the outstanding G1 server isolation and previously exposed root-key concerns.
