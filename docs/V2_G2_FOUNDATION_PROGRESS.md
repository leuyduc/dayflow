# DayFlow V2 — G2 Foundation Implementation Evidence

Date: 2026-10-12 (Asia/Bangkok)
Status: **FOUNDATION SCAFFOLD VERIFIED LOCALLY — G2 overall NOT ACCEPTED**
Branch: `feat/fullstack-foundation`
Latest validated code commit at time of report: `fa73757` (`feat(g2): validate full-stack scaffold, lock dependencies and add CI`).
`main` remains unchanged. No Linux/production deployment performed.

## Delivered source
- npm workspaces and locked dependencies (`package-lock.json`).
- `apps/web`: responsive React 19 + Vite 7 + Tailwind 4 shell with navigable Today/Tasks/Calendar/Settings sections, explicit G2-only placeholder copy, and API health display. No fake task persistence or authentication.
- `apps/api`: Fastify 5 health route `GET /api/health` bound to localhost by default.
- `packages/domain`: pure typed task status/priority/title-normalization rule and 3 unit tests.
- `packages/contracts`: starter health response contract.
- Strict TS, ESLint, Prettier scoped to source files, GitHub Actions workflow for build/test/typecheck/lint/format.
- Updated README with actual local instructions.

## Verification performed on Windows development machine
Environment: Windows, Node v24.21.0, npm 11.19.0. Dependencies installed with `npm install --ignore-scripts --no-audit --no-fund`.
- `npm run typecheck` — PASS (exit 0).
- `npm run lint` — PASS (exit 0).
- `npm run test` — PASS, 3/3 Vitest unit tests, exit 0.
- `npm run build` — PASS, both API and web builds, Vite v7.3.7, exit 0.
- `npm run format:check` — PASS on source files, exit 0.
- Runtime API check: `GET http://127.0.0.1:3002/api/health` returned `{"status":"ok","service":"dayflow-api","version":"0.1.0"}`.
- Runtime web check: `GET http://127.0.0.1:5173/` returned HTTP 200 with HTML title DayFlow.
- Git branch verification: working tree clean after commit and push; branch pushed to origin `feat/fullstack-foundation`, `fa73757`.
- GitHub Actions CI independent run status was NOT verified; browser rendering/Playwright NOT tested.

## Corrective work and lessons
Initial typecheck/build failed because Vite 6 in the web workspace conflicted with Vite 7 hoisted for Tailwind/Vitest plugin dependencies. Aligned web to Vite 7.3, regenerated lockfile, ran Prettier only on new source (not old V2 spec docs), then all five checks passed.

## Explicitly NOT done
- No user authentication, authorization, Postgres DB, migrations, real task CRUD, sync, scheduling or backups. These belong to later gates.
- No Ubuntu OpenCode/Muse installation, no Linux sandbox or production exposure.
- G1-C isolation failed in previous audit and G1-A exposed old admin key remains outstanding.
- Muse CLI provider names discovered on Windows, but two simple inference attempts did not produce a response. Muse availability is NOT established.
- G2 is NOT considered production-ready; this is an independently verifiable scaffold to unblock coding while G1 security work continues.

## Next concrete tasks
1. Verify development web UI manually in browser and add browser/component tests.
2. Confirm CI on GitHub, fix any cross-platform failures.
3. Allow Muse to pick up the feature branch only in a validated development sandbox; it manages its own context/cache.
4. Complete G1 security isolation and old-root-key revocation before Linux autonomous agent execution or deployment.
