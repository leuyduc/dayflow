# DayFlow V2 — G3 live PostgreSQL integration evidence

Date: 2026-10-12 (Asia/Bangkok)
Status: **REAL LOCAL POSTGRESQL INTEGRATION PASSED; G3 STILL REQUIRES OPERATOR ACCEPTANCE AND SECURITY REVIEW**
Working branch: `feat/g3-auth-db`
No Linux or production changes.

## What was tested
- Ran PostgreSQL **17.10** native Windows binaries in a temporary development sandbox under gitignored `.artifacts/postgres-sandbox/`.
- PostgreSQL bound to `127.0.0.1` only, test port `55432`. Generated administrator, application and owner-test passwords at runtime, never printed or committed.
- Created a separate least-privilege `dayflow_dev` database role and database `dayflow_dev_g3` for this test.
- Executed the actual guarded `migrate-development` script through a TCP PostgreSQL connection; repeated migration successfully (idempotence).
- Executed guarded `bootstrap-owner` for the initial test owner and confirmed a second bootstrap was rejected.
- Verified all four schema tables exist on real PostgreSQL.
- With the real `pg.Pool` + Drizzle store behind Fastify, tested actual HTTP login/cookie and owner-only task reads on a dynamically allocated localhost port. Also tested invalid password, anonymous rejection, session restoration, logout CSRF protection, server-side session revocation and isolation against a second fixture owner.
- Stopped the ephemeral PostgreSQL server and verified port `55432` had zero listeners afterward. No real user/account/data or production credentials were used.

## Reproducing on a Windows development workstation
Requirements: Node.js/npm, a clean local DayFlow checkout, existing compiled API and enough local disk space for an isolated ~100 MB Windows PostgreSQL binary package.

```powershell
npm ci --ignore-scripts
npm run build -w @dayflow/api
New-Item -ItemType Directory -Force -Path .artifacts/postgres-sandbox
npm install --prefix .artifacts/postgres-sandbox embedded-postgres@17.10.0-beta.17 --ignore-scripts --no-audit --no-fund
npm run test:postgres:local
```

The binary is an isolated **development test dependency**, not part of the production app or ordinary CI dependency graph; it is deliberately placed in `.artifacts/`, which is gitignored. This binary release is a prerelease wrapper and should not be used as a production deployment decision.

## Independent CI
`.github/workflows/ci.yml` now includes a separate `g3-postgres-integration` job with an ephemeral `postgres:17` service. It uses a fixed **public test-only credential** inside GitHub's throwaway runner, an isolated `dayflow_test_ci` database, and the same integration script in external mode. No live secrets or production data are available to that job.

The remote CI success/failure must be verified by exact commit SHA after pushing; do **not** claim CI passed before checking the run.

## Scope remaining
- No deployment, user-facing login UI, real task mutation API, multi-device sync or offline support.
- Operator security review and formal G3 acceptance pending, and root-key/G1 isolation issues are independent unresolved security concerns.
- Tests prove functionality against PostgreSQL 17 in local ephemeral environment; they do not establish security of the Linux production environment.
