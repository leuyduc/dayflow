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
