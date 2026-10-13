# DAYFLOW V2 — START HERE

**Active Windows workspace (2026-10-13): `D:\projects\dayflow`.** This is the only local source of truth for uncommitted development. `C:\Users\ABC\dayflow` is a preserved fallback copy, and the previous D clone was archived at `D:\projects\dayflow-legacy-bootstrap-20261013`. Never overwrite the D worktree with the older GitHub contents or C copy.

**Runnable DayFlow V2 local review:** double-click `START_DAYFLOW_LOCAL.bat` in this Windows repo, open `http://127.0.0.1:5180`, read local-only login at `.artifacts/dayflow-local-preview/LOGIN-LOCAL-ONLY.txt`. Transferable, credential-free ZIP is in `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip`. Usage and limitations: `docs/DAYFLOW_LOCAL_PREVIEW.md`. This is a local test product, NOT staging or production.

**Linux private staging is deployed and running (2026-10-13):** Ubuntu under restricted `dayflow-dev`, own PostgreSQL, production-built React/Fastify, **loopback only**, SHA-verified release; real Chrome E2E after staging restart PASS. From Windows open the Git-ignored `.artifacts/deploy/CONNECT_DAYFLOW_LINUX.bat` to establish the SSH tunnel, then open `http://127.0.0.1:5183`. The private demo login is in `.artifacts/deploy/LOGIN_DAYFLOW_LINUX_STAGING.txt`. Full evidence and controls: `docs/DAYFLOW_LINUX_STAGING_20261013.md`. This is NOT a public production release; G1/G8/G9 blockers remain.

**Mandatory context check (2026-10-13): before every resumed/new task and after any context loss, directly reread D-local `.chatgpt/STATE.md`, verify `git status`/branch/HEAD, and consult only relevant JOURNAL/LESSONS/specs. Never rely on chat cache. After every coherent code/QA step, save STATE/JOURNAL and read them back before the next step.**

**Active operator direction (2026-10-12): ChatGPT implements directly; Muse/OpenCode is removed from the workflow.**

1. **Recover context:** first read `D:\projects\dayflow\.chatgpt\STATE.md` via Windows MCP and the latest relevant local JOURNAL/LESSONS. Review task-specific V2 specs. The GitHub design branch is historical; `docs/CHATGPT_EXECUTION_PROTOCOL.md` is not present in this local checkout.
2. **Verify reality:** check D Git branch/HEAD/dirty status first, then compare with remote feature HEAD, PR and CI where available. GitHub does not yet contain the local uncommitted work; do not reset it or overwrite it from an older branch.
3. **Work directly:** within the approved Gate, ChatGPT plans, edits and tests. Commit/push only after explicit user authorization; no coding-agent handoff.
4. **After EACH logical step:** update the local D `.chatgpt/STATE.md` and append `.chatgpt/JOURNAL.md`, then read back both the checkpoint and D Git HEAD. Commit/push only when expressly authorized and quality/scope checks pass. If the read-back fails, stop with a recovery record.
5. **Respect operator approvals:** human Gate acceptance, production/SSH/DB changes and main merge are never inferred from a green CI.

## Product
DayFlow V2 is a calm responsive authenticated personal planner: React+Vite, Fastify, authoritative PostgreSQL, online sync, later calendar/scheduling, offline outbox, and validated backup/restore. No AI feature embedded.

## Current known baseline — ALWAYS VERIFY
- `main` does not contain development code; G4 at `feat/g4-task-crud` (`655d15e`) has human technical acceptance.
- Working branch `feat/g5-online-sync` is at `2cae801`, dirty/uncommitted. G5 online sync, G6 Calendar, G8 Settings/JSON backup, and extended G7 offline CRUD + static-only PWA shell are implemented in the Windows worktree. Full format/lint/typecheck, **103/103 unit tests**, build, real isolated Chrome/PostgreSQL G6/G7/G8 E2E and G7 offline PWA navigation/reload all PASS. G7 remains IN PROGRESS because a cold offline reload cannot authenticate an owner, and multi-tab/storage/privacy testing and human Gate acceptance are open. G8 offsite DB recovery drill remains open. Full dev npm audit has 7 advisories; production-only audit passed. See `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.
- Ubuntu production G1 security is not passed. No Linux production operations without separate approval.
- Historical Muse/OpenCode bootstrap instructions are retired.

Active authority: the local D `.chatgpt/STATE.md`, `docs/V2_ACTIVE_MASTER_PLAN_20261013.md` (latest execution roadmap), `AGENTS.md`, `.chatgpt/README.md`, `docs/V2_MASTER_PLAN.md` (historical design baseline), `docs/V2_PRODUCT_DECISIONS.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_IMPLEMENTATION_PLAN.md`. The older reference to `docs/CHATGPT_EXECUTION_PROTOCOL.md` is stale (file not present).
