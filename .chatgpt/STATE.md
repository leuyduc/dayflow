# DayFlow V2 — ChatGPT Operator Checkpoint

Updated: 2026-10-12 (Asia/Bangkok)
Owner of this checkpoint: ChatGPT only. Muse/OpenCode independently manages its own cache/context.
Working repo: `leuyduc/dayflow` (public).
Working docs branch: `design/linux-fullstack-v2`; default `main` untouched by design/G1 work.
Master plan: `docs/V2_MASTER_PLAN.md` (consolidated architecture, G0–G9, G1 critical path, evidence and risk register).
DO NOT put credentials, private key text, internal infrastructure addresses or production data here.

## Goal
Linux-hosted OpenCode/Muse (restricted development), React website, Fastify backend, PostgreSQL server source of truth, browser Dexie cache/offline support, secure owner login and multi-device sync. Preserve original DayFlow task/calendar/planner UX. Separate production from autonomous agent.

## End-to-end Gate status (always review all rows before new work)
| Gate | Current status | Notes |
|---|---|---|
| G0 — Linux audit | AUDITED | Ubuntu Linux host, existing production services, Docker, Nginx, Node present; OpenCode not found in root PATH as of audit; capacity and isolation risk noted |
| G1 — SSH, identity, isolation, OpenCode | IN PROGRESS / OVERALL NOT PASSED | See substeps below |
| G2 — Full-stack foundation | QA EXPANDED ON WINDOWS / GATE NOT ACCEPTED | `feat/fullstack-foundation` at `920fa74`: React/Fastify scaffold; 10/10 tests, lint/typecheck/build/format PASS; real Chrome desktop/mobile smoke PASS. GitHub Actions successful for exact SHA 920fa74; no Linux deployment. See feature-branch G2 QA evidence |
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
| G1-C strong development isolation | AUDITED — NOT PASSED | Fresh dev SSH verified; passive listener inventory and no-payload TCP connections proved reachability to 3 existing loopback services. File-permission negative tests blocked; separate strong isolation and egress controls needed. See `docs/V2_G1C_ISOLATION_AUDIT.md` |
| G1-D OpenCode/Muse on Linux | NOT STARTED | Linux OpenCode not confirmed installed; no service/tunnel for Muse yet |
| G1-E root/admin credential separation and sign-off | NOT STARTED | ChatGPT's Windows MCP can still access a root-authorized administrative SSH key, avoid broad agent delegation |

## Tooling / reality at last check
- Windows Desktop Commander connected, Git, Node and OpenCode 1.19.0 available; two OpenCode processes observed. **Muse availability/provider was not verified**; do not claim running Muse.
- Linux SSH via Windows Desktop Commander works with new separate dev/admin keys; SSH host fingerprint was verified by the operator.
- Linux contains existing live workloads; do not modify those as incidental DayFlow setup.
- On GitHub, `docs/V2_G1_SAFE_CHANGE_PLAN.md` and `docs/V2_G1B_EXECUTION_STATUS.md` record plans and evidence.
- This checkpoint is based on recorded observations; always recheck live state before actions.

## Latest planning checkpoint
- 2026-10-12: consolidated full G0–G9 master plan created and cross-checked with current checkpoint. No Linux changes, no new coding authorization, no gate status transition.

## Latest G1-C verified assessment
- 2026-10-12: Linux `dayflow-dev` logged in with separate key, only its own group, not Docker/sudo. Host filesystem/socket modes observed (not file contents), but direct sensitive-access permission checks were blocked; cannot claim negative-access PASS.
- The same user **successfully opened three no-payload TCP connections to existing host loopback services**, including a database-like endpoint. This proves network reachability, not database authorization. Network isolation FAIL until a sandbox/VM and egress policy is implemented and tested.
- No server changes made during G1-C. Details: `docs/V2_G1C_ISOLATION_AUDIT.md`.

## Direct Ubuntu MCP pairing status (2026-10-12)
- User proposed pairing Ubuntu as an additional Remote Desktop Commander device so ChatGPT can target Linux without Windows SSH relay.
- Read-only preflight via verified `dayflow-dev` SSH: Ubuntu has Node.js v26.7.0, npm/npx v11.19.0; developer home is writable, Remote Device not yet paired.
- Attempt to start Desktop Commander Remote Device through Windows MCP→SSH was BLOCKED by tool safety policy. **No installation or pairing was completed. Do not bypass the block**; operator can run the official remote pairing command interactively as `dayflow-dev` and approve OAuth on dashboard.
- Direct MCP pairing improves access but **does not fix G1-C failed network isolation**, so no autonomous Muse/production access is authorized.

## Direct Ubuntu MCP verification (2026-10-12)
- Remote Desktop Commander device list NOW confirms `ubuntu-server` ONLINE (v0.2.52) alongside Windows device ONLINE.
- Direct Ubuntu MCP `ping` returned pong (transport online).
- Direct Ubuntu MCP `start_process` attempts for `whoami` and `pwd` were BLOCKED by tool safety checks. Neither command ran, so user identity and current working directory on the newly paired device are **UNVERIFIED**.
- This updates prior "not paired" state: pairing succeeded, but terminal access through this integration is still BLOCKED. Do not claim `dayflow-dev` is the remote MCP process identity simply because earlier SSH used that user.
- No Linux service, config, filesystem or production changes were made in this verification turn.

## Fast-track coding checkpoint — 2026-10-12
- Following operator direction to accelerate, feature branch `feat/fullstack-foundation` created from V2 design docs and real scaffold committed there; code commit `fa73757`, evidence doc follows in branch.
- Windows worktree created under user workspace, npm dependencies resolved with `--ignore-scripts`, lockfile committed. Vite version mismatch fixed by aligning to Vite 7.
- Verified `npm run typecheck`, `lint`, `test` (3/3), `build`, `format:check` all exit 0, plus local API and web HTTP smoke. Git push success.
- Web and API dev servers started on Windows localhost for smoke tests; may still be running at this checkpoint; must check live state on resumption.
- No deployment to Linux, no G1 security pass; Muse inference still not verified. G2 scaffold exists but overall G2 gate NOT ACCEPTED.

## Next appropriate action
Ask operator to approve one of: (preferred) separate VM/host with explicit network restrictions, or a verified rootless isolated container/sandbox with restricted host/LAN egress and no production mounts. First remediate G1-A exposed key before marking overall G1 PASS. Do not install OpenCode, deploy, use root for Muse, grant Docker/sudo, or run Muse autonomously until approved isolation is tested.

## Safety and operator preferences
- ChatGPT keeps a persistent journal and lessons after meaningful actions to survive lost ChatGPT context; each new session reconciles entire G0–G9 overview before selecting next step.
- Muse/OpenCode handles its own context and caches. Do not burden Muse with forced repeated context reads, recaps or duplicated token-expensive documents.
- Human acceptance at each Gate, evidence before PASS, no automatic merge/deploy.

## Connection and Muse smoke check — 2026-10-12
- Both Ubuntu and Windows devices were listed Online; Ubuntu MCP ping responded. Ubuntu MCP metadata and home-directory listing worked, showing /home/dayflow-dev exists with mode 0700; remote agent Linux process identity is NOT established.
- Direct Ubuntu terminal commands are still blocked before execution. Ubuntu config reports /bin/bash default shell and blocked command list; these details do not explain platform-level blocking. Do not circumvent tool safety checks.
- Windows OpenCode CLI 1.19.0 lists Muse Spark 1.3 providers/models, including opencode/muse-spark-1.3-contributor-free. This is model DISCOVERY, not proof that inference works.
- A minimal read-only Windows OpenCode model smoke attempt emitted no output and stayed blocked; only this test session was terminated and a follow-up session list was empty. Model execution remains UNVERIFIED.
- No DayFlow code, Linux services, SSH policy, Docker settings or production data changed. Overall G1 still NOT PASSED, G1-C isolation not remediated, G1-D unstarted.
- Next: resolve direct MCP terminal restrictions through supported app permissions if available; operator approval needed before attempting G1-C sandbox provisioning or Linux OpenCode installation. Lightweight isolated sandbox favored over a full VM only if network egress and production separation are demonstrated.

## Additional OpenCode credential check (2026-10-12)
- Windows CLI `opencode providers list` returned 3 configured credential providers: OpenCode Go, OpenRouter and nvidia-glm. No tokens were read or recorded.
- Retried a harmless one-line inference request against `opencode-go/muse-spark-1.3-contributor` using plan/pure mode. It produced no output during repeated polling, showed a waiting process, and that single test process was terminated.
- Model inference remains BLOCKED / UNVERIFIED. Existing OpenCode sessions and DayFlow repository unchanged. Investigate provider/CLI logs via sanctioned non-secret diagnostics before code delegation; avoid repeated blind invocations.

## G2 QA expansion — 2026-10-12 (latest execution checkpoint)
- Code branch: `feat/fullstack-foundation`. Latest verified code commit **`920fa74`**, pushed to origin. Local working tree clean after successful fetch/rebase; the remote-only commit was an existing G2 documentation addition, integrated without force-push.
- Real Windows development checks: `npm run typecheck` PASS, `npm run lint` PASS, `npm run test` PASS **10/10** (3 domain + 3 Fastify injection + 4 React component), `npm run build` PASS, `npm run format:check` PASS.
- Playwright Core against already installed Chrome: `npm run test:browser` PASS: real desktop navigation/API status, mobile navigation/no horizontal overflow, no JavaScript page errors. Local screenshots saved under ignored `.artifacts/`, not published.
- Fastify app factory separated from server listener for repeatable integration testing; test dependencies and reproducible smoke script in committed npm lockfile.
- **GitHub Actions CI independent result UNVERIFIED** (no statuses surfaced by accessible connector, not proof of absence or success). G2 overall still awaits operator acceptance; G3/real DB not implemented.
- No Linux/production changes, no Muse deployment, G1-C remains unresolved; old exposed root SSH key still requires revocation.
- Latest source evidence: `docs/V2_G2_QA_EXPANSION_20261012.md` on the feature branch. Next: review G2/CI and request scoped approval for G3 only in non-production; continue security remediation separately.

## Independent CI verification — 2026-10-12
- Queried public GitHub Actions runs for exact SHA `920fa74cf5ce50a8f20ffd25f8768978e0cff891`: `dayflow-foundation-ci` run **38163990311** status `completed`, conclusion `success`. URL: https://github.com/leuyduc/dayflow/actions/runs/38163990311 .
- This supersedes earlier `CI UNVERIFIED` statements **for SHA 920fa74 only**. The status is independent GitHub Actions evidence, distinct from local test results. G2 full acceptance remains pending, since DB/migrations/other architectural work and operator gate acceptance are not complete.
- Worktree was clean after rebase and push of feature-branch commit; remaining risk G1-A exposed root key and G1-C Linux agent isolation unchanged.
