> **WORKFLOW OVERRIDE 2026-10-12:** Direct ChatGPT implementation replaces OpenCode/Muse coding. The user requires a GitHub checkpoint update and re-read **after every logical step** (see `docs/CHATGPT_EXECUTION_PROTOCOL.md`). Historical agent references below are no longer executable instructions. G1 production security remains blocked.

# DayFlow V2 — Full-stack Technical Architecture

## Logical topology
ChatGPT direct coding --> approved Windows/GitHub development tools
Users' browsers -- HTTPS --> Caddy reverse proxy --> / (built React app), /api (Fastify API)
Fastify API -- private service network --> PostgreSQL (authoritative data)
Browsers -- Dexie/IndexedDB --> cached tasks and pending edits; sync with API
GitHub -- PR review + CI --> approved release artifact --> controlled production deploy

Direct development and production may share a Linux host ONLY after proven isolation and scoped operator authorization; Muse/OpenCode runtime is no longer part of this design.

## Locked stack (verify compatibility at G0)
Monorepo: npm workspaces (or existing manager if audited and justified).
- apps/web: React, TypeScript strict, Vite, Tailwind, Dexie, date-fns, accessible components; optional PWA at G7.
- apps/api: Node.js, TypeScript strict, Fastify, Zod request validation, structured redacted logging.
- packages/domain: pure task/scheduling rules; never import React, DB, Node or HTTP.
- packages/contracts: versioned API request/response schemas and shared types.
- packages/test-utils: fixtures, fake clock and test helpers only if necessary.
- infra: Docker/Compose production specifications, Caddy, migration and deploy scripts.
- PostgreSQL via Drizzle ORM with explicit, reviewed migrations.
- Vitest + React Testing Library, API integration tests against isolated test DB, Playwright E2E.
Version selection deferred until actual Linux G0 audit; commit lockfile.

## Identity and authorization
- Initial MVP is single-owner, provisioned through a restricted bootstrap process; signup endpoint is disabled.
- Prepare userId scoping on all user records so the data model can support additional accounts later without exposing them now.
- Password storage using Argon2id; rate limit login and audit security actions.
- Server-side session identifiers in secure, HttpOnly, SameSite cookies over HTTPS; server-backed expiration/revocation; CSRF protection for state-changing actions.
- Never store access tokens or session secrets in localStorage or IndexedDB.
- Every API and sync query authorizes record ownership server-side.

## Data
Tables (initial model; exact migration reviewed at G3):
users, sessions, tasks, settings, change_log, processed_mutations; optional backup/import history.
Tasks have UUID, user_id, title, description, status, priority, due_date (DATE/explicit date-only), estimated_minutes, scheduled_start/end (timestamptz), tags, subtasks, created_at, updated_at, completed_at, revision, deleted_at.
Settings include user_id, IANA time_zone, working_days, local business hours, duration, buffer, week_starts_on, theme, revision.
Indices target user_id + updated/seq/status/schedule. Soft deletion tombstones are mandatory for sync.
Prefer server-generated timestamps, validated changes and transactional invariants.

## API boundary (proposed)
- GET /api/health/live (non-sensitive), GET /api/health/ready (restricted if appropriate).
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me; secure owner bootstrap outside public signup.
- GET/POST/PATCH/DELETE /api/tasks for online operations.
- GET/PATCH /api/settings.
- POST /api/sync/push, GET /api/sync/pull?cursor=..., GET /api/sync/bootstrap.
- GET /api/backup/export; POST /api/backup/validate; POST /api/backup/import with explicit preview/confirmation.
Exact contracts and permissions are specified before implementation.

## Serving, environments, and isolation
- Caddy terminates HTTPS and routes same-origin /api; no public Postgres port.
- Separate dev/test/staging/production credentials, databases, container networks, volumes and compose project names.
- Production runtime is immutable deployment output, not agent workspace mounted into production.
- CI executes lint, typecheck, tests, build, security checks and artifact creation.
- Human approves promotions; development tooling cannot autonomously deploy to production, change DNS, access prod credentials or run prod migrations.

## Non-functional requirements
Responsive keyboard-accessible UI; explicit loading/empty/error/conflict states; request IDs; health/readiness probes; deploy rollback plan; offsite encrypted DB backup and restore drill; logging without task content or secrets; HTTPS only outside localhost.
