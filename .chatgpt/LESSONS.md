# DayFlow V2 — ChatGPT Lessons Learned (append only)

**Applies only to ChatGPT's coordination and recovery, not Muse/OpenCode context or cache management.**
Capture concrete mistakes/causes/preventive checks; no need to invent a lesson if none arose.

## 2026-10-12 — Never trust plan status without live verification
Observed: Linux carried many existing services, open listening ports and container workloads. It was not an empty VPS.
Lesson: Audit real service/port/resource state before proposing any installs or port allocations; never treat documentation as live evidence.

## 2026-10-12 — SSH host identity before enabling automation
Observed: SSH host fingerprint was checked against a trusted Linux console before strict host-key login.
Lesson: Never use `StrictHostKeyChecking=no` or blindly add unknown host keys. Separate operator SSH root key from developer SSH key.

## 2026-10-12 — Avoid brittle shell transport and validator assumptions
Observed: PowerShell-to-SSH quoting/CRLF and interpretation of `sshd -T` multi-value `allowusers` caused aborted checks/rollback despite a valid proposed SSH configuration.
Lesson: Prefer minimal, inspectable scripts with explicit exit codes; parse tool output semantically rather than relying on a single exact string; verify effective policy and service health before/after every modification. Errors must be reported; rollback should preserve access.

## 2026-10-12 — Partial gates are not full security acceptance
Observed: Account creation and fresh SSH login succeeded, but negative privilege tests were blocked and an exposed old root key remains authorized.
Lesson: Mark G1-B PARTIAL, G1 overall NOT PASSED, and prevent autonomous Muse from accessing production even if developer account login works.

## 2026-10-12 — Distinguish ChatGPT context from Muse context
Observed: ChatGPT conversation/runtime context can be lost or compacted; Muse runs in OpenCode, which manages its own session/context.
Lesson: Store checkpoint, journal and lessons in `.chatgpt/`; each ChatGPT session rereads the concise state and verifies live progress. **Do not impose repeated full-document reads or external cache synchronization on Muse**, and do not spend Muse tokens on ChatGPT recovery.

## 2026-10-12 — Account permissions are not network isolation
Observed: `dayflow-dev` lacked sudo/docker group privileges, yet TCP handshakes to three existing host loopback services succeeded. No database authentication or secret reads were attempted.
Lesson: Never treat a dedicated Unix user or Docker socket DAC mode as sufficient for running autonomous code beside production. Require verified namespace/VM boundaries, explicit egress restrictions and deny-access tests before agent execution; distinguish TCP reachability from data access.

## 2026-10-12 — Blocked negative tests cannot be claimed successful
Observed: remote tool safety policy blocked direct sensitive-file permission probes, though filesystem modes could be inspected safely.
Lesson: Record access-denial tests as BLOCKED/UNVERIFIED and base recommendations on what was genuinely observed. Do not bypass tool safety controls just to manufacture a PASS.

## 2026-10-12 — Device access is not agent isolation
Observed: Direct Remote Desktop Commander Linux pairing could simplify access, but the G1-C audit already demonstrated a dev account could reach localhost services; an attempt to launch the pairing remotely was blocked by platform safety controls.
Lesson: Pair devices only with explicit operator verification, do not circumvent tool blocks, and do not confuse remote MCP terminal access with a production-safe code-execution sandbox. Keep read-only audit and broader agent permissions separately gated.

## 2026-10-12 — MCP online is not shell-access proof
Observed: Ubuntu remote device advertised Online and responded to ping, but direct read-only `whoami` and `pwd` execution were blocked by platform safety checks.
Lesson: Distinguish device registration, transport health, actual shell execution and authorization as separate checkpoints. Do not claim Linux user identity verified merely from a device name or an earlier SSH session, and do not bypass execution policy.

## 2026-10-12 — Model discovery is not a successful model invocation
Observed: OpenCode displayed Muse Spark 1.3 in its model list, but a deliberately minimal model invocation did not produce output and remained waiting until the test process was terminated.
Lesson: Check provider/model availability using a bounded harmless smoke test before delegating development. Treat non-responsive sessions as unverified; do not report Muse as working just because the model name appears. Never conflate MCP Online, file access, shell access and model inference.

## 2026-10-13 — Diagnose cross-platform line endings before bulk formatting
Observed: after copying a Windows Git checkout with `core.autocrlf=true`, full Prettier --check reported 36 files, but a read-only check with `--end-of-line auto` left only one file requiring substantive formatting.
Lesson: when formatting appears globally broken, check Git's working-tree line endings and Prettier's end-of-line behavior before writing to dozens of unrelated files. Prefer an explicitly tested cross-platform configuration and focused formatting; rerun all QA after changing tooling policy.

## 2026-10-13 — Service worker cached bundles can still fail offline due to Vary
Observed: production Chrome offline reload retrieved static HTML but failed to load hashed JS/CSS even though Cache Storage held those exact URLs. SW fetch events were active; direct Cache match differed from install-time fetch due request/response Vary headers. Using Cache.match with ignoreVary **only for allowlisted immutable same-origin public static bundles** enabled true offline reload. The private API path remained uncached.
Lesson: never claim offline readiness just because a service worker installed or precache entries exist. Test real browser offline navigation AND reload, assert application rendered and no sensitive API responses entered cache. Treat ignoreVary as unsafe for user-specific responses and restrict its use to immutable public assets.

## 2026-10-13 — Offline UI acknowledgement is not network-commit evidence
Observed: a G6/G8 Chrome test intermittently asserted that a dropped-response request was intercepted immediately after a pending IndexedDB task appeared; local queued UI updates precede asynchronous network dispatch.
Lesson: test the explicit matching network mutation and await its server-commit signal (with timeout and cleanup) before asserting delivery/response loss. Do not conflate an optimistic local UI state with a network transaction result.

## 2026-10-13 — Session cookies can switch owners while a tab remains open
Observed: with the same-origin browser session cookie changed by another tab, an existing task workspace could remain mounted, and its cache/bootstrap/outbox might otherwise be associated with the wrong owner.
Lesson: bind offline replay AND cache/bootstrap/pull to the owner that created the local work, reject mismatches on the server, and reverify active session identity on tab focus/reconnect before continuing to show private data. A network outage alone must not erase pending work.

## 2026-10-13 — Idempotency requires durable journaling even when the browser is online
Observed: G5 server-side idempotency could not prevent a lost HTTP acknowledgement from leaving TaskWorkspace's direct online PATCH/DELETE/full-edit actions without a stable retry key. The API might already have committed the write when the client received a network error.
Lesson: every state-changing client action must persist its exact owner, mutation UUID, task ID, expected revision and immutable payload in durable storage **before** HTTP, not only during navigator.onLine=false. Retrying must reuse the old key; semantic conflicts remain reviewable, and a human-authorized overwrite must create a distinct new key/revision. Verify by intentionally dropping the response *after* real PostgreSQL COMMIT and checking there is no extra revision or duplicate record.

## 2026-10-13 — Windows PostgreSQL default encoding is not safely Unicode
Observed: a fresh persistent embedded PostgreSQL 17 cluster on this Windows machine defaulted to WIN1252, so a valid Vietnamese task title failed with SQLSTATE 22P05. The React/API/ORM builds and English smoke could pass while real Vietnamese data failed.
Lesson: force `initdb --encoding=UTF8 --locale=C` for new development/demo PostgreSQL clusters, query `SHOW server_encoding` on reuse, and run an E2E insert/readback with Vietnamese text. Never reset an existing non-UTF8 DB silently; preserve it for deliberate migration/recovery.

## 2026-10-13 — A release package needs a clean-unzip smoke, not just a ZIP check
Observed: the explicit whitelist ZIP passed structural privacy checks, but packaging initially failed on PowerShell command argument handling and ZIP entry path separators. Corrected the script, then installed dependencies inside a freshly extracted copy and completed a real Chrome/Fastify/PostgreSQL smoke test.
Lesson: validate a portable build in a new extraction directory with fresh dependencies and a separate test database. Never include .git, node_modules, .artifacts, local credentials or data in transfer artifacts. A local demo PASS does not imply production security approval.

## 2026-10-13 — Test runners must exclude ignored extracted release copies
Observed: extracting a portable DayFlow source ZIP under `.artifacts/` inside the repo made Vitest collect duplicate tests from both actual source and the copy, inflating 103 to 206 despite all tests passing.
Lesson: Git ignore does not guarantee Vitest scan exclusion. Preserve test defaults but explicitly exclude `**/.artifacts/**`. Verify actual **file count**, not just overall PASS count, before asserting regression coverage.

## 2026-10-13 — Cross-platform ZIPs must be checked on the target OS
Observed: a ZIP made with Windows PowerShell `Compress-Archive` held backslash path separators. Windows accepted it but Ubuntu unzip warned/aborted extraction despite matching SHA-256.
Lesson: require POSIX member names and verify them when packaging via Python stdlib; hash equality alone does not prove extraction compatibility. Validate extraction/build on the actual Linux target and preserve partial failed release rather than overwriting unrelated directories.

## 2026-10-13 — Skipped npm scripts can leave bundled native ICU symlinks missing
Observed: `@embedded-postgres/linux-x64` shipped `libicu{uc,i18n,data}.so.60.2` but not corresponding `.so.60` symlinks. `initdb` errored with missing `libicuuc.so.60`, even though complete library payloads existed locally.
Lesson: inspect native `ldd` and bundled library directory before installing deprecated global libraries. Fix only verified soname symlinks inside the project-local dependency tree, check `ldd`, and avoid sudo, apt or host-wide library changes on a shared server.

## 2026-10-13 — Service stop proof is a process/port/data check, not just a log line
Observed: SIGTERM stopped the staging Node process and database, freed UI/PG localhost listeners and removed `postmaster.pid`, but the expected `DAYFLOW_LOCAL_PREVIEW_POSTGRES_STOPPED` log marker was absent.
Lesson: do not manufacture a STOP marker; verify actual PID, port and DB state independently, preserve old log/PID before restart, and prove persisted-data reuse plus Chrome E2E after restart. For long-term ops a supervised, restricted systemd user service with an approved restart policy is preferable to nohup.

## 2026-10-13 — Do not confuse PWA/JSON export with complete PostgreSQL recovery
Observed: Linux staging performs a successful G8 JSON download through Chrome, but the actual isolated PostgreSQL 17 binary bundle has no pg_dump/pg_restore and system pg_dump is version 14.24. A real DB restore drill is not executable until a compatible, verified PG17 client is available. A user-level systemd manager in degraded state with Linger=no also does not prove auto-start after reboot.
Lesson: keep application portability distinct from database disaster recovery. Demand compatible client, encrypted off-host archive, tested restore into a separate scratch database, content verification and operational supervision before G8/G9 acceptance. Record actual precheck and stop conditions, not optimistic PASS claims.
