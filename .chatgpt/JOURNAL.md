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
