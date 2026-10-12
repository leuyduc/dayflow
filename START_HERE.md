# DAYFLOW V2 — START HERE

**Active operator direction (2026-10-12): ChatGPT implements directly; Muse/OpenCode is removed from the workflow.**

1. **Recover context:** fetch `.chatgpt/STATE.md` from `design/linux-fullstack-v2` and read `docs/CHATGPT_EXECUTION_PROTOCOL.md`. Review latest relevant JOURNAL/LESSONS, V2 product/security/sync documents and the target source branch.
2. **Verify reality:** recheck exact GitHub feature HEAD, PR, and CI outcome. Other sessions can progress independently, so never trust stale chat cache.
3. **Work directly:** within the approved Gate, ChatGPT plans, edits, tests and commits itself. No coding-agent handoff.
4. **After EACH logical step:** write current STATE + append JOURNAL to GitHub, then **re-fetch and READ checkpoint and feature HEAD before the next step**. On failure stop with a recovery record.
5. **Respect operator approvals:** human Gate acceptance, production/SSH/DB changes and main merge are never inferred from a green CI.

## Product
DayFlow V2 is a calm responsive authenticated personal planner: React+Vite, Fastify, authoritative PostgreSQL, online sync, later calendar/scheduling, offline outbox, and validated backup/restore. No AI feature embedded.

## Current known baseline — ALWAYS VERIFY
- `main` does not contain development code; G4 at `feat/g4-task-crud` (`655d15e`) has human technical acceptance.
- G5 `feat/g5-online-sync` (`4f75f7a`) has implementation and verified CI, Gate acceptance pending; delta UI/offline remain incomplete.
- Ubuntu production G1 security is not passed. No Linux production operations without separate approval.
- Historical Muse/OpenCode bootstrap instructions are retired.

Active authority: `docs/CHATGPT_EXECUTION_PROTOCOL.md`, `docs/V2_MASTER_PLAN.md`, `docs/V2_PRODUCT_DECISIONS.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_IMPLEMENTATION_PLAN.md`.
