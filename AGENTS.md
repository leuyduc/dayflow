# DayFlow V2 — Direct ChatGPT Implementation

> **ACTIVE (2026-10-12):** ChatGPT is the only coder and project executor. **No Muse/OpenCode implementation, delegation or separate agent cache.** Older references are historical. V2 overrides contradictory V1 local-only rules.

## Essential startup
1. **Use `D:\projects\dayflow` as the active local repository.** Read its `START_HERE.md` and `.chatgpt/STATE.md` first, then only relevant plans and latest JOURNAL/LESSONS. `docs/CHATGPT_EXECUTION_PROTOCOL.md` is missing locally; do not assume its contents.
2. Verify the D worktree branch, HEAD and uncommitted changes, then check GitHub branch/PR/CI as available; the local uncommitted work must not be reset from remote.
3. Confirm user-approved Gate scope, risks and evidence target. Do not treat CI PASS as Gate acceptance.

## Mandatory per-step loop
For **EVERY independently verifiable logical step** (feature, QA, fix, PR, migration, gate substep):
- **BEFORE:** reread D-local STATE, branch HEAD/status and relevant source; check remote divergence when needed; mark IN_PROGRESS for long/interrupted-risk work.
- **EXECUTE:** ChatGPT directly edits code/docs and runs available tests; no delegated agent.
- **AFTER:** update D-local STATE for ALL G0–G9 plus current step/commit/CI/acceptance/blockers/next action; append JOURNAL. Commit/push only when the user authorizes it.
- **READ BACK:** reread D-local STATE plus D Git HEAD **before doing another step**. Stop if read-back fails. New chats must recover from D-local state and compare remote GitHub, not from conversation cache alone.

Workflow authority: `START_HERE.md` and `.chatgpt/README.md`; `docs/CHATGPT_EXECUTION_PROTOCOL.md` is referenced historically but absent from this checkout.

## Product and constraints
DayFlow V2: React/Vite/TypeScript web, Fastify/Zod API, PostgreSQL/Drizzle authority, secure session, multi-device sync (G5), scheduling/calendar (G6), IndexedDB offline queue (G7), safe backup/import (G8) and controlled release (G9). No AI assistant embedded in the product. Strict domain logic and authorization, deterministic date/time rules, accessible responsive UI.

## Safety and engineering
- Do not merge or force-push to `main` or deploy without user permission. Protect other workers' new commits, verify exact SHAs.
- G1-A old root key + G1-C Linux dev isolation remain security blockers; former G1-D OpenCode installation is retired (NOT passed). Windows/test-CI coding authorization never implies production server access.
- No sudo/root/Docker socket, production DB or secrets, production migrations or server settings without separate scoped approval.
- Run actual format, lint, strict typecheck, tests, build and real browser/PostgreSQL integration as relevant, and verify exact-sha CI. Label blocked checks truthfully.
