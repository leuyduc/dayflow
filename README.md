# DayFlow V2 — Full-stack foundation

This branch (`feat/fullstack-foundation`) contains the first working development scaffold for DayFlow V2. **It is not deployed** and does not yet implement authentication, task persistence, synchronization, or offline edits.

## Architecture
- `apps/web`: React 19 + Vite 7 + Tailwind 4, accessible responsive navigation and API status
- `apps/api`: Fastify 5 HTTP service (development health endpoint only)
- `packages/domain`: pure typed task rules with Vitest unit tests
- `packages/contracts`: shared API contract types
- Root: npm workspaces, ESLint, Prettier, TypeScript strict

## Local setup
Requires Node.js 22.12 or later and npm.

```bash
npm ci
npm run dev:api
# in a separate terminal:
npm run dev:web
```

Web: http://127.0.0.1:5173
API health: http://127.0.0.1:3002/api/health

## Checks
```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
```

These checks validate only the G2 scaffold. Real authentication, PostgreSQL persistence and protected API behavior belong to later Gates.

## Source of truth
V2 product/architecture/QA: `docs/V2_MASTER_PLAN.md` and other `docs/V2_*.md`.
The `.chatgpt/` directory is ChatGPT-only continuity and **not** Muse/OpenCode cache.
Do not deploy this branch to the live Linux server before security isolation and gate approval.