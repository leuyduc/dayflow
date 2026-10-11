> **DAYFLOW V2 — ACTIVE AUTHORITY (2026-10-11)**
> The approved direction is Linux-hosted OpenCode/Muse + web frontend + backend + PostgreSQL + authenticated cross-device synchronization.
> Read `docs/V2_PRODUCT_DECISIONS.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_IMPLEMENTATION_PLAN.md` first.
> V2 supersedes V1 wherever V1 says no account/backend/cloud sync or local storage is sole source of truth. The V1 files remain references for task UX, domain, scheduling and accessibility only where consistent with V2.
> **CURRENT GATE: G0 audited; G1-B developer SSH login partially verified; G1-A key revocation deferred; G1-C isolation pending. Do NOT install/run Muse on Linux, implement DayFlow code or deploy without explicit scoped approval and isolation verification.**
> **ChatGPT-specific continuity logs live in `.chatgpt/`; these are NOT Muse/OpenCode context/cache instructions and require no repeated reading by Muse.**

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
