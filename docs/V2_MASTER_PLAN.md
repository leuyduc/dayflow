# DAYFLOW V2 — MASTER PLAN
> Revision: 1.0 | 2026-10-12 | Status: approved direction, gated execution | Repository: `leuyduc/dayflow` | Design branch: `design/linux-fullstack-v2`

## 1. Product and operating objective
Deliver a secure responsive personal planner accessible from browsers on desktop/mobile:
- Fast task capture; task CRUD, notes, priority, tags, subtasks, dates, estimates, search/filter/sort and Today/Inbox/Upcoming/Completed/All.
- Calendar day/week/month and deterministic, explainable schedule suggestions with manual accept/edit/reject.
- Owner login, server-authoritative PostgreSQL persistence, multi-device synchronization with conflict handling.
- Offline-first local Dexie/IndexedDB cache/outbox only after rigorous synchronization testing.
- Versioned JSON export/import and separate off-host encrypted PostgreSQL backups, with restore test.
- DayFlow product does NOT embed an AI assistant. Muse is the external development agent.

Operator workflow: User approves direction/releases; ChatGPT coordinates/verifies via Desktop Commander/GitHub and holds ChatGPT-only journal; OpenCode/Muse on restricted Linux dev workspace implements scoped coding tasks and manages its own context/cache; CI supplies independent test evidence.

## 2. Architecture and production boundary
- Windows: operator control device; SSH with verified server host key, Desktop Commander MCP.
- Linux: restricted developer workspace (Muse/OpenCode), isolated staging and separately protected production. Existing production services must not be disrupted.
- Web: React + TypeScript strict + Vite + Tailwind; accessibility and responsive UX.
- API: Fastify + TypeScript + Zod; secure same-origin cookie-based sessions, CSRF protection, rate limiting, ownership-based record authorization.
- DB: PostgreSQL + Drizzle migrations; revisions, idempotency IDs, tombstones and commit-safe change cursor; IANA timezone stored for consistent planning across devices.
- Browser cache: Dexie/IndexedDB, pending offline operations only when G7 approved.
- Operations: preserve current Nginx/reverse-proxy infrastructure unless independently approved change, no port collision, TLS, separate dev/test/staging/prod secrets, off-host encrypted backups, supervised deployment.
- Agent security: no root/sudo/Docker socket, no production secrets/DB/deploy credentials; account isolation alone insufficient, especially when local services are network-accessible. Prefer VM/host isolation where required.

## 3. Dependency and gate sequence (G0–G9)
| Gate | Work package | Acceptance / evidence | Last known |
|---|---|---|---|
| G0 | Audit Linux OS/resources/SSH/ports/processes/services/tooling | Verified inventory, hazards and non-disruption rules | AUDITED |
| G1 | Security, restricted access and Linux OpenCode | Root/dev auth, privilege-denial/isolation tests, local-only agent access, no prod exposure | IN PROGRESS, NOT PASSED |
| G2 | Full-stack foundation: monorepo web/api/domain/contracts/infra/tests | Dev web + API, type/lint/test/build and browser smoke | WINDOWS QA VERIFIED (10/10 tests, real Chrome smoke); GitHub Actions SUCCESS for 920fa74; GATE NOT ACCEPTED |
| G3 | Owner bootstrap/auth + PostgreSQL and migrations | Login/logout, CSRF/rate limit, server-owned CRUD/transactions, negative access tests | TECHNICAL GATE ACCEPTED BY USER (a3074d9, CI 38166399632); G1 production security still blocks deployment |
| G4 | Tasks + personal planning UI | Real create/edit/complete/delete/reload, filtering, accessible/mobile flows | DEVELOPED ON WINDOWS (b435f4d), local QA 27 tests + PostgreSQL + Chrome PASS; GitHub Actions 38167837603 SUCCESS; operator acceptance pending |
| G5 | Two-device online sync | Idempotent changes, revision conflict UI, tombstones, reconnect A/B tests | NOT STARTED |
| G6 | Day/week/month calendar + deterministic scheduling | No silent overlaps, timezone/DST/deadline/buffer tests, save only accepted suggestion | NOT STARTED |
| G7 | Offline-first and outbox | Offline edits, restart/reconnect, conflict decisions, no silent data loss | NOT STARTED |
| G8 | Settings/backup/import and server DR | Validation/preview/transactional restore, off-host encrypted backups + restore drill | NOT STARTED |
| G9 | Release-readiness/staging/prod | CI, E2E, accessibility/security, TLS, approved migration, monitoring, rollback plan, manual release approval | NOT STARTED |

Do not claim a gate passed solely from an agent report. Verify commands/results and have the operator approve the gate explicitly. A blocker may require reverting to the prior safe state.

## 4. G1 execution plan — immediate critical path
Last verified facts (read-only audit + later scoped G1-B actions):
- Ubuntu host has 4 logical CPUs, 15 GiB RAM and ~101 GiB disk free at audit; it is running other live applications and Nginx/Docker.
- Windows MCP has working SSH access, verified host key and newly created separate admin/dev keys.
- `dayflow-dev` (uid 1001) created with locked password and restricted home; fresh SSH login via its dedicated key was successful; root remained reachable; SSH/Nginx/Docker/UFW/cloudflared services active after controlled SSH reload.
- G1-A: previously exposed root SSH public key remains enabled (user deferred revocation). SECURITY BLOCKER for claiming overall G1 pass or production-ready.
- G1-B: account/login partially passed; complete negative privilege testing blocked by MCP command policy. The existing root-authorized key is still accessible through Windows remote automation.
- G1-C: AUDITED / NOT PASSED (2026-10-12). The developer account can establish no-payload TCP connections to 3 pre-existing loopback services, including a database-like endpoint; file-permission negative tests were blocked. A separate VM/host or proven namespace/sandbox with restricted egress and no production mounts is required. See `docs/V2_G1C_ISOLATION_AUDIT.md`. Check resource budgets and workspace isolation; consider separate VM if same-host boundaries inadequate.
- G1-D: not started. After G1-C and scoped approval, install OpenCode under developer identity, select/test Muse, bind OpenCode only to localhost, connect Windows via SSH tunnel; no public agent port.
- G1-E: not started. Move/root admin credentials out of agent-accessible automation identity; validate rollback/console and service integrity; close G1 only when all relevant requirements meet acceptance.

Priority order: (1) remediate exposed root key, without losing admin access; (2) G1-C access and isolation tests; (3) select isolation design based on real host conditions; (4) G1-D OpenCode/Muse and a harmless read-only smoke session; (5) G1-E operator sign-off. If user intentionally defers (1), keep G1 security BLOCKED rather than silently treating as passed.

## 5. Implementation milestones after G1
G2: foundation scaffold QA verified on Windows; remaining gate review and CI pending. Technical work establishes `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, `infra/`. Add test scripts and single coherent first vertical slice; do not add speculative infrastructure. Choose compatible supported Node release after environment compatibility test rather than blindly using current system-installed runtime.

G3–G4: implement single-owner bootstrap and secure sessions, then task CRUD over API with PostgreSQL as authoritative source. Preserve task domain invariants: status, title validation, date-only vs UTC instant, completed/reopened timestamp transitions, and no silent schedule overlap.

G5: design tested idempotent sync protocol with per-record revisions, server validation, change feed/cursor and tombstones. Conflicts must be visible; never silently overwrite newer server edits.

G6: pure schedule algorithm with explicit IANA timezone, DST, priority/deadline ordering, workdays/hours/buffers, existing event obstacles; preview first, persist accepted changes only.

G7: offline writes in durable client outbox, reconnect replay, secure account cache handling, PWA only after tests; service-worker caching must not expose private data across accounts.

G8–G9: migration-safe import/export, off-host DB backups and a successful test restore; CI, staging E2E, load/resource checks suitable for the real hardware, human-controlled production release without Muse production authority.

## 6. GitHub and quality governance
- Keep `main` unchanged until PR review and explicit approval.
- V2 design documentation remains on `design/linux-fullstack-v2`; create a separate implementation feature branch from accepted specification before code.
- Every gate: inspect current Git state, implement a small testable unit, validate change scope, record actual test commands/results + commit SHA/screenshots/known limitations, pause for acceptance.
- CI minimum: format, lint, strict TypeScript, unit/integration, build, E2E where relevant, secret/dependency scan.
- No confidential data in repo or logs: public repository; protect private keys, user data, backend credentials, LAN inventory and production configuration.

## 7. Separate ChatGPT and Muse context policies
ChatGPT **must** retrieve `.chatgpt/STATE.md` at start/recovery, verify latest real progress, consult relevant journal/lessons and update checkpoint after each meaningful step. Only ChatGPT is required to do this due to its context limitations.

Muse/OpenCode **independently manages its own context, session and cache**. No requirement to reread entire specs or ChatGPT checkpoint after each step and no automatic replay of ChatGPT logs into Muse prompts. Muse reads what is relevant to a new assigned coding task and performs normal necessary project verification.

## 8. Highest-priority risks and mitigations
| Risk | Priority | Mitigation |
|---|---|---|
| Exposed old root SSH key still authorized | CRITICAL | Rotate/revoke using tested new key and console recovery; keep G1 blocked until remediated |
| Root credentials available to Windows automation | HIGH | Split administrative key from low-privilege agent control; deny Muse access |
| Existing production services share host with code-running agent | HIGH | Real privilege and network isolation tests; use VM/separate host if needed |
| Docker-published database port in host inventory | HIGH | Audit exposure separately; do not modify unrelated containers while scoping G1 |
| Resource contention on 4-core host and active swap | MEDIUM/HIGH | Limit agent workloads, monitor memory/disk/CPU and avoid concurrent production stress |
| Data-loss/conflict during sync/import/migration | HIGH | Revisioned/idempotent protocol, transactional writes, backups, E2E and restore drills |
| Timezone and DST planning errors | HIGH | Date-only vs UTC instants separation; IANA planning zone and deterministic tests |
| Stale ChatGPT context/cache | PROCESS | Versioned `.chatgpt/` checkpoint, live reconciliation and append-only journal; Muse unaffected |

## 9. Current conclusion
As of this checkpoint, the project is **still before autonomous Muse execution on Linux**. The next safe substantive action is operator approval for G1-C isolation remediation with verified egress restrictions and remediation of the deferred G1-A root key. G2 has a verified Windows-only React/Fastify scaffold with 10/10 tests and real desktop/mobile Chrome smoke, but is not formally accepted or deployed. G3 was technically accepted by the operator with separate G1 risks still open. G4 has local Windows development implementation and checks for task CRUD/React and awaits CI evidence and operator acceptance. G5–G9 have not started. Do not infer PASS from documentation alone.
