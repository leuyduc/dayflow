# DayFlow V2 — Direct ChatGPT Implementation

> **ACTIVE (2026-10-12):** ChatGPT is the only coder and project executor. **No Muse/OpenCode implementation, delegation or separate agent cache.** Older references are historical. V2 overrides contradictory V1 local-only rules.

## Essential startup
1. Read `START_HERE.md`, `docs/CHATGPT_EXECUTION_PROTOCOL.md` and GitHub `.chatgpt/STATE.md` on `design/linux-fullstack-v2`.
2. Verify current target feature branch HEAD, GitHub PR/CI and only relevant latest JOURNAL/LESSONS and task-specific V2 specs.
3. Confirm user-approved Gate scope, risks and evidence target. Do not treat CI PASS as Gate acceptance.

## Mandatory per-step loop
For **EVERY independently verifiable logical step** (feature, QA, fix, PR, migration, gate substep):
- **BEFORE:** refetch GitHub STATE, branch HEAD and relevant source; mark IN_PROGRESS for long/interrupted-risk work.
- **EXECUTE:** ChatGPT directly edits code/docs and runs available tests; no delegated agent.
- **AFTER:** update STATE for ALL G0–G9 plus current step/commit/CI/acceptance/blockers/next action; append JOURNAL; commit.
- **READ BACK:** refetch and READ persisted STATE plus target HEAD **before doing another step**. Stop if read-back fails. New chat must recover from GitHub, not conversation cache.

Full instructions: `docs/CHATGPT_EXECUTION_PROTOCOL.md`.

## Product and constraints
DayFlow V2: React/Vite/TypeScript web, Fastify/Zod API, PostgreSQL/Drizzle authority, secure session, multi-device sync (G5), scheduling/calendar (G6), IndexedDB offline queue (G7), safe backup/import (G8) and controlled release (G9). No AI assistant embedded in the product. Strict domain logic and authorization, deterministic date/time rules, accessible responsive UI.

## Safety and engineering
- Do not merge or force-push to `main` or deploy without user permission. Protect other workers' new commits, verify exact SHAs.
- G1-A old root key + G1-C Linux dev isolation remain security blockers; former G1-D OpenCode installation is retired (NOT passed). Windows/test-CI coding authorization never implies production server access.
- No sudo/root/Docker socket, production DB or secrets, production migrations or server settings without separate scoped approval.
- Run actual format, lint, strict typecheck, tests, build and real browser/PostgreSQL integration as relevant, and verify exact-sha CI. Label blocked checks truthfully.
