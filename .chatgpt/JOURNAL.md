# DayFlow V2 — ChatGPT Execution Journal (append only)
Public, sanitized record of actions and supporting evidence. **ChatGPT-only continuity; not required Muse input.**

## 2026-10-11 — V2 direction and design
- User selected option D: Linux hosts Muse/OpenCode, web, backend and synchronized data.
- Created `design/linux-fullstack-v2`, authored architecture, sync, infra security, bootstrap and G0–G9 plan. V1 kept for reference. No application code or deployment.
- Result: DESIGN FILES WRITTEN. Gate G0 still required.

## 2026-10-12 — Windows remote MCP access
- Desktop Commander connection verified online; Windows OpenCode CLI version 1.19.0, Git and Node available.
- Created separate new root-admin SSH key and verified local ACL. Operator validated Linux SSH host fingerprint out-of-band. Fresh SSH admin login succeeded.
- Result: Windows-to-Linux administrative SSH access verified. **Old previously exposed root key was not yet revoked.**

## 2026-10-12 — G0 Linux audit
- Checked distro, CPU/RAM/disk, running ports/services, Docker, Nginx, SSH, UFW, Git/Node/npm, OpenCode in PATH.
- Found active existing workloads, Docker-published network ports and production isolation concerns. Linux OpenCode not found in root PATH.
- Result: G0 INFORMATION COLLECTED; design requires strict isolation; no server deployment.

## 2026-10-12 — G1-A revocation preflight
- Tried exact-match checks of old/new key in authorized_keys. Shell comparison was inconsistent; follow-up verification was blocked by tool safety enforcement.
- **No public key was revoked.** User explicitly instructed to skip to the next step.
- Result: G1-A DEFERRED; compromised key still a security concern.

## 2026-10-12 — G1-B restricted dev account
- Created separate Windows dev SSH key with owner-only private-file ACL.
- Linux `dayflow-dev` user and private home created, password locked, no extra membership according to `id`; new public key installed.
- Updated SSH drop-in from `AllowUsers root` to `AllowUsers root dayflow-dev` after validation. An initial overly strict validator caused an automatic rollback; revised validator handled `sshd -T` as two `allowusers` lines.
- Controlled SSH reload performed; fresh root and dev logins both succeeded. SSH/Nginx/Docker/UFW/Cloudflared remained active. Negative privilege test via remote MCP was blocked.
- Result: G1-B PARTIAL PASS, G1 overall NOT PASSED. Not yet installed Muse/OpenCode on Linux.

## 2026-10-12 — ChatGPT-only persistent state protocol
- User required durable project journal/lessons due to ChatGPT context limits, clarified Muse uses OpenCode's native session/context/cache and MUST NOT be forced to reread specs for ChatGPT's sake.
- Created separate `.chatgpt/` files under the V2 design branch. Scoped recovery/checkpointing entirely to ChatGPT, with latest-state-first reading to save work and tokens.
- Result: DOCUMENTATION/CONTINUITY CHANGE ONLY. No remote machine modifications in this step.

## 2026-10-12 — Consolidated master plan
- Re-read current ChatGPT checkpoint, execution journal, G1 change plan and V2 implementation plan; summarized end-to-end G0–G9 dependencies, gate evidence, isolation and release workflow.
- Wrote `docs/V2_MASTER_PLAN.md` to the V2 design branch. Muse's own context/cache policy remains independent; the `.chatgpt/` recovery files continue to apply only to ChatGPT.
- Result: MASTER PLAN RECORDED; no code, server or gate-state changes. G1-A old key outstanding; G1-C isolation next.

## 2026-10-12 — G1-C read-only isolation audit
- Authenticated to Linux as restricted `dayflow-dev`, confirmed UID/GID and only its own group, reviewed filesystem modes and Docker socket metadata without reading secret contents.
- Passive network listener inspection detected multiple local-only and published services. A no-payload TCP connect from `dayflow-dev` succeeded to 3 pre-existing localhost services (including a database-like endpoint), demonstrating absence of sufficient local-network isolation.
- Sensitive file read/write permission probes were blocked by tool safety controls; these are BLOCKED/UNVERIFIED, not PASS. The current process net namespace was observable, but PID1 comparison was inconclusive.
- Resource snapshot remained about 10 GiB available RAM and 101 GiB free disk on a multi-workload host.
- Created `docs/V2_G1C_ISOLATION_AUDIT.md` with remediation options and acceptance tests. **No Linux configuration or service changes**.
- Status: G1-C AUDITED / NOT PASSED; G1 overall NOT PASSED; G1-A exposed key unresolved; G1-D OpenCode installation not started. Next: approve a stronger isolated environment and egress controls.

## 2026-10-12 — Proposed direct Ubuntu MCP device
- Operator proposed connecting Ubuntu directly as a second Desktop Commander device to remove repeated Windows→SSH relay.
- Confirmed official provider supports Ubuntu/Linux Remote Device with `npx @wonderwhy-er/desktop-commander@latest remote` and OAuth pairing; requires local user initiation/approval.
- Read-only SSH as `dayflow-dev` showed Node v26.7.0, npm/npx 11.19.0, writable developer home, no prior device pairing confirmed.
- Remote launch attempt through Desktop Commander/SSH was blocked by platform safety checks; **no remote command installation, device pairing, service configuration or Linux changes completed**.
- Operator must initiate the pairing interactively under unprivileged developer user; verify second device online afterwards. G1-C isolation remains FAILED and G1-A exposed admin key is unresolved.

## 2026-10-12 — Two-device MCP and Windows Muse probe
- Verified both devices Online. Ubuntu ping, restricted home metadata and home directory listing succeeded. Ubuntu direct shell calls remain blocked by tool safety restrictions; identity via direct terminal not verified.
- Inspected non-secret Ubuntu Desktop Commander settings: default shell Bash, allowedDirectories empty, standard blockedCommands. No config changed.
- Used Windows MCP to inspect OpenCode 1.19.0. Muse Spark 1.3 appears in the model list; CLI supports noninteractive run.
- Started harmless one-line Muse connection probe on Windows. No output returned; process remained waiting. Terminated only the probe session; subsequent Desktop Commander session listing was empty. Muse runtime NOT VERIFIED.
- No Linux changes and no DayFlow implementation. Gate status unchanged: G1-C isolation failed, G1-D pending.

## 2026-10-12 — OpenCode Go provider smoke retry
- Checked CLI provider credential status: OpenCode Go, OpenRouter and nvidia-glm are configured (provider names only; no secrets retrieved).
- A minimal `opencode-go/muse-spark-1.3-contributor` response test produced no output and remained blocked. Terminated only that test process.
- Result: Muse runtime not verified; do not hand off coding yet. No server or repo changes.

## 2026-10-12 — Fast-track G2 foundation on non-production Windows
- Operator asked to accelerate after prolonged setup. Created `feat/fullstack-foundation` from V2 design branch without modifying `main` or Linux services.
- Authored web React/Vite/Tailwind navigation shell, Fastify API health endpoint, typed domain/contracts package, npm workspaces, lint/format/type/test scripts.
- Downloaded repository on Windows under user workspace. `npm install --ignore-scripts` succeeded. Initial TypeScript/build failed because Vite 6 and Vite 7 plugin versions conflicted; aligned web Vite 7 and regenerated dependency lockfile.
- Verified actual commands: typecheck PASS; lint PASS; Vitest 3/3 PASS; build PASS; scoped format check PASS. API localhost health returned OK, website localhost returned HTTP 200. Browser E2E/CI pipeline not yet confirmed.
- Committed and pushed verified changes (code commit `fa73757`), added CI workflow, lockfile and README; G2 evidence documented in `docs/V2_G2_FOUNDATION_PROGRESS.md` on feature branch.
- No Linux/Muse/production changes; overall G1 still FAIL/DEFERRED security and G2 not formally accepted. This prepares a running foundation, not a finished DayFlow.
