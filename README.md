> **DAYFLOW V2 — ACTIVE AUTHORITY (2026-10-11)**
> The approved direction is Linux-hosted OpenCode/Muse + web frontend + backend + PostgreSQL + authenticated cross-device synchronization.
> Read `docs/V2_PRODUCT_DECISIONS.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_IMPLEMENTATION_PLAN.md` first.
> V2 supersedes V1 wherever V1 says no account/backend/cloud sync or local storage is sole source of truth. The V1 files remain references for task UX, domain, scheduling and accessibility only where consistent with V2.
> **STOP: The only next authorized activity is G0 read-only Linux audit, using `PROMPT_FOR_MUSE_V2.md`. No code, installation, production access, merge or deploy without gate approval.**

# DayFlow

DayFlow is a local-first personal planner for fast task capture, task details, calendar planning, and editable schedule suggestions.

## Current status
This branch contains the product and implementation specifications for an autonomous implementation agent. The application is to be built according to `AGENTS.md`, `START_HERE.md`, and `docs/`.

## Product principles
- Private and local-first: user data stays in the browser's IndexedDB.
- No account, backend, cloud sync, or AI feature in the MVP.
- Calendar distinguishes deadlines from planned work blocks.
- Schedule suggestions are previews until explicitly accepted.
- Backup and restore keep user data portable.

## Start implementing
Use Muse 1.3 via OpenCode from this repository and instruct it to read `AGENTS.md` and `START_HERE.md`, then follow the implementation plan. The agent should work on `prompt/agent-bootstrap` and must not merge to `main` without explicit permission.

See `docs/IMPLEMENTATION_PLAN.md` for milestones and `docs/TEST_PLAN.md` for release gates.
