> **DAYFLOW V2 — ACTIVE AUTHORITY (2026-10-11)**
> The approved direction is Linux-hosted OpenCode/Muse + web frontend + backend + PostgreSQL + authenticated cross-device synchronization.
> Read `docs/V2_PRODUCT_DECISIONS.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_IMPLEMENTATION_PLAN.md` first.
> V2 supersedes V1 wherever V1 says no account/backend/cloud sync or local storage is sole source of truth. The V1 files remain references for task UX, domain, scheduling and accessibility only where consistent with V2.
> **STOP: The only next authorized activity is G0 read-only Linux audit, using `PROMPT_FOR_MUSE_V2.md`. No code, installation, production access, merge or deploy without gate approval.**

# Prompt for Muse 1.3 (OpenCode)

You are working in the Git repository `leuyduc/dayflow`.

Read `AGENTS.md`, `START_HERE.md`, and every specification under `docs/` before changing code. Then implement DayFlow end-to-end, following `docs/IMPLEMENTATION_PLAN.md` and the definition of done in `AGENTS.md`.

Rules:
- Stay on branch `prompt/agent-bootstrap`. Do not merge into or push changes to `main`.
- Work autonomously. Do not ask the user to make routine implementation decisions; choose simple, well-supported defaults and document meaningful deviations.
- Inspect the repository before editing. Preserve existing work.
- Build a complete, runnable MVP, not just a plan or mockup.
- Use React + TypeScript + Vite, strict TypeScript, Tailwind, Dexie/IndexedDB, and the testing stack described in the architecture spec unless a concrete environment limitation prevents it.
- Keep all user data local. Do not add accounts, a backend, cloud sync, collaboration, analytics, or AI features.
- Implement task capture/CRUD, details, completion/reopen, search/filter/sort, Today/Inbox, calendar day/week/month, deterministic editable schedule suggestions, settings, and validated backup export/import.
- Keep domain logic independent of React and persistence adapters. Test scheduling and import validation thoroughly.
- Make the UI responsive and accessible. Do not leave core buttons inert or core screens as placeholders.
- Run the actual available formatter/linter, typecheck, tests, and production build. Fix failures where possible and report honestly any checks blocked by the environment.
- Update README with setup, scripts, architecture, and known limitations.
- Commit logical milestones on this branch if git access is available; never commit secrets.

Start now: inspect the repo and current branch, read all specs, then implement the highest-priority vertical slice and continue through all phases. Do not stop after presenting a plan. At the end, report what was implemented, key files, exact verification commands/results, and remaining issues.
