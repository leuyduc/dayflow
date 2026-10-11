# Start Here — DayFlow

You are the implementation agent (Muse 1.3 via OpenCode). Read `AGENTS.md`, then all documents in `docs/`. Implement the product without waiting for further prompts.

## Product in one sentence
DayFlow is a calm, fast, local-first personal planner that captures tasks quickly, stores useful task details, shows tasks in list and calendar views, and helps users propose and manually adjust a realistic daily schedule.

## First actions
1. Confirm the current branch is `prompt/agent-bootstrap`; do not work on `main`.
2. Read the full spec set.
3. Create a short checklist from `docs/IMPLEMENTATION_PLAN.md`.
4. Scaffold the project with React + TypeScript + Vite, Tailwind CSS, a consistent accessible component system, Dexie/IndexedDB, date utilities, and Vitest. Add Playwright if the environment supports browser tests.
5. Implement a vertical slice first: create task → persist → display → edit/complete → test.
6. Continue through calendar, scheduling, backup/restore, polish, and verification.

## Important
- Make decisions autonomously where details are not specified.
- Keep all user data local; do not require login or a server.
- No AI features in the product MVP.
- Never report a test as passing unless you actually ran it.
- Commit logical milestones if git access is available, on this branch only.
