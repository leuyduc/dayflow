# DayFlow V2 — ChatGPT Operator Checkpoint

Updated: 2026-10-12 (Asia/Bangkok)
Owner of this checkpoint: ChatGPT only. Muse/OpenCode independently manages its own cache/context.
Working repo: `leuyduc/dayflow` (public).
Working docs branch: `design/linux-fullstack-v2`; default `main` untouched by design/G1 work.
DO NOT put credentials, private key text, internal infrastructure addresses or production data here.

## Goal
Linux-hosted OpenCode/Muse (restricted development), React website, Fastify backend, PostgreSQL server source of truth, browser Dexie cache/offline support, secure owner login and multi-device sync. Preserve original DayFlow task/calendar/planner UX. Separate production from autonomous agent.

## End-to-end Gate status (always review all rows before new work)
| Gate | Current status | Notes |
|---|---|---|
| G0 — Linux audit | AUDITED | Ubuntu Linux host, existing production services, Docker, Nginx, Node present; OpenCode not found in root PATH as of audit; capacity and isolation risk noted |
| G1 — SSH, identity, isolation, OpenCode | IN PROGRESS / OVERALL NOT PASSED | See substeps below |
| G2 — Full-stack foundation | NOT STARTED | No implementation authorized |
| G3 — Authentication + database | NOT STARTED | |
| G4 — Task UI/API | NOT STARTED | |
| G5 — Two-device online sync | NOT STARTED | |
| G6 — Calendar + scheduling | NOT STARTED | |
| G7 — Offline queue and PWA | NOT STARTED | |
| G8 — Import/export + DB backups | NOT STARTED | |
| G9 — Staging/production release | NOT STARTED | |

## G1 substeps
| Step | Status | Evidence or concern |
|---|---|---|
| G1-A old root-key revocation | DEFERRED BY USER / SECURITY BLOCKER | Old exposed public key was observed authorized on Linux; new admin key works. Revocation attempt not completed, old key presumed active |
| G1-B restricted developer identity | PARTIAL PASS | `dayflow-dev` uid 1001 created, password locked, private home, user-owned public-key SSH. Fresh Windows→Linux SSH returned `whoami=dayflow-dev`; root fresh login still works. `sshd -t` passed; SSH reloaded; SSH/Nginx/Docker/UFW/Cloudflared active afterward. Full negative permission tests blocked by MCP policy |
| G1-C strong development isolation | NOT STARTED | Account separation alone is insufficient; agent must not reach prod secrets, databases, Docker socket or network endpoints |
| G1-D OpenCode/Muse on Linux | NOT STARTED | Linux OpenCode not confirmed installed; no service/tunnel for Muse yet |
| G1-E root/admin credential separation and sign-off | NOT STARTED | ChatGPT's Windows MCP can still access a root-authorized administrative SSH key, avoid broad agent delegation |

## Tooling / reality at last check
- Windows Desktop Commander connected, Git, Node and OpenCode 1.19.0 available; two OpenCode processes observed. **Muse availability/provider was not verified**; do not claim running Muse.
- Linux SSH via Windows Desktop Commander works with new separate dev/admin keys; SSH host fingerprint was verified by the operator.
- Linux contains existing live workloads; do not modify those as incidental DayFlow setup.
- On GitHub, `docs/V2_G1_SAFE_CHANGE_PLAN.md` and `docs/V2_G1B_EXECUTION_STATUS.md` record plans and evidence.
- This checkpoint is based on recorded observations; always recheck live state before actions.

## Next appropriate action
Plan/test G1-C isolation **without any unauthorised production changes**, or address unresolved G1-A security risk. Do not install OpenCode, deploy, use root for agent, grant Docker/sudo, or run Muse autonomously until isolation and scoped approval are documented.

## Safety and operator preferences
- ChatGPT keeps a persistent journal and lessons after meaningful actions to survive lost ChatGPT context; each new session reconciles entire G0–G9 overview before selecting next step.
- Muse/OpenCode handles its own context and caches. Do not burden Muse with forced repeated context reads, recaps or duplicated token-expensive documents.
- Human acceptance at each Gate, evidence before PASS, no automatic merge/deploy.
